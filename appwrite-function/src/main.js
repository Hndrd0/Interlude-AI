import { Client, Databases, Query } from 'node-appwrite';
import fetch from 'node-fetch';

const TOKENS_PER_HOUR = 100000;

// Global Cache for G4F Models
let MODEL_CACHE = null;
let CACHE_EXPIRY = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getAvailableModels(apiKey, log) {
    if (MODEL_CACHE && Date.now() < CACHE_EXPIRY) {
        return MODEL_CACHE;
    }

    try {
        const response = await fetch("https://g4f.space/v1/models", {
            headers: {
                "Authorization": `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch models, status: ${response.status}`);
        }

        const data = await response.json();
        MODEL_CACHE = data.data || [];
        CACHE_EXPIRY = Date.now() + CACHE_TTL_MS;
        return MODEL_CACHE;
    } catch (err) {
        log(`Error fetching models for cache: ${err.message}`);
        // If cache fetch fails, return previous cache if exists, otherwise empty array
        return MODEL_CACHE || [];
    }
}

export default async ({ req, res, log, error }) => {
    console.log("Incoming body:", req.body);

    // Helper to log all returns
    const returnJson = (obj, status, headers) => {
        console.log("Returning:", JSON.stringify(obj));
        return res.json(obj, status, headers);
    };

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
            return returnJson({ error: 'Missing User ID' }, 401, corsHeaders);
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
            return returnJson({ error: "Database unavailable" }, 500, corsHeaders);
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
                    return returnJson({ success: true, isAdmin: true, message: 'Admin access granted.' }, 200, corsHeaders);
                }
                return returnJson({ success: false, message: 'Invalid or expired code.' }, 400, corsHeaders);
            } catch (e) {
                error("Promo code check error:", e);
                return returnJson({ success: false, message: 'Database error checking code.' }, 500, corsHeaders);
            }
        }

        // --- Handle Usage Stats Request ---
        if (action === 'get_usage') {
            return returnJson({
                tokenUsed: userDoc.tokenUsed,
                limit: TOKENS_PER_HOUR,
                isAdmin: userDoc.isAdmin,
                windowStart: userDoc.windowStart
            }, 200, corsHeaders);
        }

        // --- Handle Models Request ---
        if (action === 'models') {
            const availableModels = await getAvailableModels(process.env.G4F_API_KEY, log);
            return returnJson({
                success: true,
                models: availableModels
            }, 200, corsHeaders);
        }

        // --- Handle Debug Models Request ---
        if (action === 'debug_models') {
            const availableModels = await getAvailableModels(process.env.G4F_API_KEY, log);
            return returnJson({
                count: availableModels.length,
                models: availableModels
            }, 200, corsHeaders);
        }

        // --- Handle Chat Request ---
        if (action === 'chat') {
            const messages = body.messages || [];
            const requestedModel = body.model;

            if (!requestedModel) {
                return returnJson({ error: 'Missing model in payload' }, 400, corsHeaders);
            }

            // Quota check before request
            if (!userDoc.isAdmin && userDoc.tokenUsed >= TOKENS_PER_HOUR) {
                return returnJson({ error: 'Hourly quota exceeded. Please wait or use a promo code.' }, 429, corsHeaders);
            }

            try {
                const validModels = await getAvailableModels(process.env.G4F_API_KEY, log);
                console.log("Requested model:", requestedModel);
                console.log("Available model count:", validModels.length);

                const matchedModel = validModels.find(m => m.id === requestedModel);
                console.log("Matched model:", matchedModel);

                if (!matchedModel) {
                    return returnJson({
                        success: false,
                        error: "Invalid model",
                        requestedModel: requestedModel
                    }, 400, corsHeaders);
                }

                const g4fPayload = {
                    model: requestedModel,
                    messages: messages
                };

                console.log("Payload:");
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
                    log(`Response headers: ${JSON.stringify(Object.fromEntries(g4fRes.headers.entries()))}`);
                    log(`Response body: ${errText}`);
                    log(`Selected model: ${requestedModel}`);

                    return returnJson({
                        success: false,
                        model: requestedModel,
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

                return returnJson({ content: responseText }, 200, corsHeaders);

            } catch (chatError) {
                error("G4F Request Exception:", chatError);
                return returnJson({ error: 'Failed to communicate with AI provider.' }, 500, corsHeaders);
            }
        }

        return returnJson({ error: 'Invalid action' }, 400, corsHeaders);

    } catch (e) {
        console.error(e);
        return returnJson({
            success: false,
            error: e.message,
            stack: e.stack
        }, 500, corsHeaders);
    }
};
