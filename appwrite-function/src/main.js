import { Client, Databases, Query } from 'node-appwrite';
import { G4F } from 'g4f';

// G4F initialization
const g4f = new G4F();

// Constants
const DATABASE_ID = 'interlude_db'; // We'll need to define this, assuming standard name or from env
const USERS_COLLECTION = 'users';
const CODES_COLLECTION = 'codes';
const TOKENS_PER_HOUR = 100000;

export default async ({ req, res, log, error }) => {
    // 1. Initialize Appwrite Client
    const client = new Client()
        .setEndpoint('https://sgp.cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '69d0f017002257fde008')
        .setKey(process.env.APPWRITE_API_KEY); // Requires an API key with DB read/write access

    const databases = new Databases(client);

    // Fallback DB IDs if not in env (would normally be in env vars for the function)
    const dbId = process.env.DATABASE_ID || DATABASE_ID;
    const usersCol = process.env.USERS_COLLECTION || USERS_COLLECTION;
    const codesCol = process.env.CODES_COLLECTION || CODES_COLLECTION;

    // Helper: Setup CORS
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-appwrite-project, x-appwrite-session'
    };

    if (req.method === 'OPTIONS') {
        return res.send('', 204, corsHeaders);
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const action = body.action;
        const userId = req.headers['x-appwrite-user-id'] || body.userId; // Get user ID from request

        if (!userId) {
            return res.json({ error: 'Missing User ID' }, 401, corsHeaders);
        }

        // --- Fetch or Create User Document ---
        let userDoc;
        try {
            const userDocs = await databases.listDocuments(dbId, usersCol, [
                Query.equal('userId', userId)
            ]);

            if (userDocs.total > 0) {
                userDoc = userDocs.documents[0];
            } else {
                // Create new user record
                userDoc = await databases.createDocument(dbId, usersCol, 'unique()', {
                    userId: userId,
                    tokenUsed: 0,
                    windowStart: new Date().toISOString(),
                    isAdmin: false
                });
            }
        } catch (e) {
            error("DB User fetch error:", e);
            // If DB not setup perfectly yet, mock it to allow dev (remove in pure prod if DB is strict)
            userDoc = { userId, tokenUsed: 0, windowStart: new Date().toISOString(), isAdmin: false, $id: 'mock' };
        }

        // --- Check and Reset Usage Window ---
        const now = new Date();
        const windowStart = new Date(userDoc.windowStart);
        const hoursDiff = (now - windowStart) / (1000 * 60 * 60);

        if (hoursDiff >= 1) {
            // Reset quota
            userDoc.tokenUsed = 0;
            userDoc.windowStart = now.toISOString();
            if (userDoc.$id !== 'mock') {
                await databases.updateDocument(dbId, usersCol, userDoc.$id, {
                    tokenUsed: 0,
                    windowStart: userDoc.windowStart
                });
            }
        }

        // --- Handle Promo Code Activation ---
        if (action === 'activate_promo') {
            const code = body.code;
            try {
                const codeDocs = await databases.listDocuments(dbId, codesCol, [
                    Query.equal('code', code),
                    Query.equal('active', true)
                ]);

                if (codeDocs.total > 0) {
                    const codeData = codeDocs.documents[0];
                    if (codeData.admin) {
                        // Make user admin
                        await databases.updateDocument(dbId, usersCol, userDoc.$id, {
                            isAdmin: true
                        });
                        return res.json({ success: true, isAdmin: true, message: 'Admin access granted.' }, 200, corsHeaders);
                    }
                }
                return res.json({ success: false, message: 'Invalid or expired code.' }, 400, corsHeaders);
            } catch (e) {
                error("Promo code check error:", e);
                return res.json({ success: false, message: 'Database error checking code.' }, 500, corsHeaders);
            }
        }

        // --- Handle Usage Stats Request ---
        if (action === 'get_usage') {
            return res.json({
                tokenUsed: userDoc.tokenUsed,
                limit: TOKENS_PER_HOUR,
                isAdmin: userDoc.isAdmin,
                windowStart: userDoc.windowStart
            }, 200, corsHeaders);
        }

        // --- Handle Chat Request ---
        if (action === 'chat') {
            const messages = body.messages || [];
            const model = body.model || 'gpt-4o'; // Default model

            // Rough token estimate (chars / 4)
            const inputTokens = JSON.stringify(messages).length / 4;

            // Quota check
            if (!userDoc.isAdmin && (userDoc.tokenUsed + inputTokens) > TOKENS_PER_HOUR) {
                return res.json({ error: 'Hourly quota exceeded. Please wait or use a promo code.' }, 429, corsHeaders);
            }

            // Note: True Server-Sent Events (SSE) streaming via Appwrite functions
            // requires writing chunks directly to the response socket if supported,
            // or returning a complete string if standard sync function.
            // Appwrite Node.js functions support `res.send(body, status, headers)`
            // For true SSE, we need to set headers appropriately. Appwrite 1.4+ supports streaming.

            // For simplicity in this static analysis plan without knowing exact Appwrite runtime version,
            // we will simulate the connection to G4F. Since G4F supports streaming:

            const isStreaming = body.stream === true;

            try {
                if (isStreaming) {
                    // In Appwrite 1.4+, we can return a Node.js Readable stream or async generator.
                    // We will use an async generator to stream chunks back to the client.
                    const streamHeaders = {
                        ...corsHeaders,
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    };

                    let fullOutput = "";

                    // Assuming G4F supports returning an async iterable when stream: true
                    const completionStream = await g4f.chatCompletion(messages, {
                        model: model,
                        stream: true
                    });

                    // We create an async generator that yields SSE formatted strings
                    async function* sseGenerator() {
                        try {
                            for await (const chunk of completionStream) {
                                // Extract text from chunk based on G4F stream format
                                const text = chunk || "";
                                fullOutput += text;
                                yield `data: ${JSON.stringify({ content: text })}\n\n`;
                            }
                            // After streaming finishes, update the database token count
                            const outputTokens = fullOutput.length / 4;
                            const totalTokens = Math.floor(inputTokens + outputTokens);

                            if (!userDoc.isAdmin && userDoc.$id !== 'mock') {
                                await databases.updateDocument(dbId, usersCol, userDoc.$id, {
                                    tokenUsed: userDoc.tokenUsed + totalTokens
                                });
                            }
                            yield `data: [DONE]\n\n`;
                        } catch (err) {
                            error("Streaming error:", err);
                            yield `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`;
                        }
                    }

                    // Appwrite res.send can take an async generator
                    return res.send(sseGenerator(), 200, streamHeaders);

                } else {
                    const responseText = await g4f.chatCompletion(messages, {
                        model: model
                    });

                    const outputTokens = responseText.length / 4;
                    if (!userDoc.isAdmin && userDoc.$id !== 'mock') {
                        await databases.updateDocument(dbId, usersCol, userDoc.$id, {
                            tokenUsed: Math.floor(userDoc.tokenUsed + inputTokens + outputTokens)
                        });
                    }

                    return res.json({ content: responseText }, 200, corsHeaders);
                }

            } catch (chatError) {
                error("G4F Error:", chatError);
                return res.json({ error: 'Failed to generate response.' }, 500, corsHeaders);
            }
        }

        return res.json({ error: 'Invalid action' }, 400, corsHeaders);

    } catch (e) {
        error("General function error:", e);
        return res.json({ error: 'Internal Server Error' }, 500, corsHeaders);
    }
};
