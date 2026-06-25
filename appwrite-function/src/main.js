import { Client, Databases, Query } from 'node-appwrite';
import fetch from 'node-fetch';

const TOKENS_PER_HOUR = 100000;

const MODEL_WHITELIST = [
  "gpt-5",
  "gpt-4.1",
  "gpt-4o",
  "claude-sonnet-4",
  "claude-opus-4",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "deepseek-r1",
  "deepseek-v3",
  "qwen-3-235b",
  "llama-4-maverick"
];

export default async ({ req, res, log, error }) => {
    // 1. Initialize Appwrite Client
    const client = new Client()
        .setEndpoint('https://sgp.cloud.appwrite.io/v1')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '69d0f017002257fde008')
        .setKey(process.env.APPWRITE_API_KEY); // Requires an API key with DB read/write access

    const databases = new Databases(client);

    // Environment variables for DB and Collections (MUST NOT HARDCODE)
    const dbId = process.env.DATABASE_ID;
    const usersCol = process.env.USERS_TABLE_ID;
    const codesCol = process.env.CODES_TABLE_ID;

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
            // CRITICAL FIX: No mock fallback allowed
            return res.json({ error: "Database unavailable" }, 500, corsHeaders);
        }

        // --- Check and Reset Usage Window ---
        const now = new Date();
        const windowStart = new Date(userDoc.windowStart);
        const hoursDiff = (now - windowStart) / (1000 * 60 * 60);

        if (hoursDiff >= 1) {
            // Reset quota
            userDoc.tokenUsed = 0;
            userDoc.windowStart = now.toISOString();
            await databases.updateDocument(dbId, usersCol, userDoc.$id, {
                tokenUsed: 0,
                windowStart: userDoc.windowStart
            });
        }

        // --- Handle Promo Code Activation ---
        if (action === 'activate_promo') {
            const code = body.code;
            try {
                const codeDocs = await databases.listDocuments(dbId, codesCol, [
                    Query.equal('code', code),
                    Query.equal('active', true),
                    Query.equal('admin', true)
                ]);

                if (codeDocs.total > 0) {
                    // Make user admin permanently
                    await databases.updateDocument(dbId, usersCol, userDoc.$id, {
                        isAdmin: true
                    });
                    return res.json({ success: true, isAdmin: true, message: 'Admin access granted.' }, 200, corsHeaders);
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

        // --- Handle Models Request ---
        if (action === 'models') {
            return res.json({
                success: true,
                models: MODEL_WHITELIST.map(id => ({ id, name: id }))
            }, 200, corsHeaders);
        }

        // --- Handle Chat Request ---
        if (action === 'chat') {
            const messages = body.messages || [];
            let requestedModel = body.model || 'srv_mkoloq41e34074b6133e:gpt-5.5'; // Default model

            // Quota check before request
            if (!userDoc.isAdmin && userDoc.tokenUsed >= TOKENS_PER_HOUR) {
                return res.json({ error: 'Hourly quota exceeded. Please wait or use a promo code.' }, 429, corsHeaders);
            }

            try {
                console.log("Requested model:", requestedModel);

                let model = requestedModel;
                if (!MODEL_WHITELIST.includes(requestedModel)) {
                    console.log(`Invalid model ${requestedModel}, falling back to gpt-4o`);
                    model = "srv_mkoloq41e34074b6133e:gpt-5.5";
                }

                console.log("Final model:", model);

                const g4fPayload = {
                    model: model,
                    messages: messages
                };

                console.log(JSON.stringify(g4fPayload, null, 2));

                // Call Official G4F API directly using fetch and secret API Key
                const g4fRes = await fetch("https://g4f.space/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.G4F_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(g4fPayload)
                });

                if (!g4fRes.ok) {
                    const errText = await g4fRes.text();
                    log(`G4F API Error: Status ${g4fRes.status}`);
                    log(`Response body: ${errText}`);
                    log(`Selected model: ${model}`);

                    return res.json({
                        success: false,
                        model: model,
                        status: g4fRes.status,
                        g4fError: errText
                    }, 500, corsHeaders);
                }

                const g4fData = await g4fRes.json();
                const responseText = g4fData.choices[0].message.content;

                // Real Token Tracking via API response if available, fallback to length estimate
                let totalTokens = g4fData.usage?.total_tokens;
                if (!totalTokens) {
                   const inputLen = JSON.stringify(messages).length;
                   const outputLen = responseText.length;
                   totalTokens = Math.floor((inputLen + outputLen) / 4);
                }

                // Update tokens
                if (!userDoc.isAdmin) {
                    await databases.updateDocument(dbId, usersCol, userDoc.$id, {
                        tokenUsed: userDoc.tokenUsed + totalTokens
                    });
                }

                return res.json({ content: responseText }, 200, corsHeaders);

            } catch (chatError) {
                error("G4F Request Exception:", chatError);
                return res.json({ error: 'Failed to communicate with AI provider.' }, 500, corsHeaders);
            }
        }

        return res.json({ error: 'Invalid action' }, 400, corsHeaders);

    } catch (e) {
        error("General function error:", e);
        return res.json({ error: 'Internal Server Error' }, 500, corsHeaders);
    }
};
