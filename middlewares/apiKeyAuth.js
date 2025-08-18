const pool = require("../database/databaseConnection");

async function apiKeyAuth(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({ error: 'API key required' });
        }

        const result = await pool.query(
            `SELECT * 
             FROM public.api_keys 
             WHERE key = $1 
             AND is_active = true
             AND (expires_at IS NULL OR expires_at > NOW())`,
            [apiKey]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Invalid or expired API key' });
        }

        // Attach user_id to the request for downstream use
        req.user_id = result.rows[0].user_id;

        next();
    } catch (err) {
        console.error("API Key Auth Error:", err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = apiKeyAuth;
