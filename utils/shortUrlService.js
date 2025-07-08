const axios  = require("axios");
const { nanoid } = require('nanoid');
const axios = require("axios");

exports.generateShortUrl=async(url)=>{
    try {
        // Ensure URL is encoded properly
        const encodedUrl = encodeURIComponent(url);
        const response = await axios.get(
            `https://click.wa.expert/api/sh?url=${encodedUrl}`,
            { timeout: 5000 }
        );
        console.log(`🔗 URL shortened: ${url} → ${response.data.shortUrl || response.data.shortened_url}`);
        return response.data.shortened_url;
    } catch (error) {
        console.error("❌ Error shortening URL:", error.message);
        return url;
    }
};

// URL shortening GET endpoint
app.get('/sh', async (req, res) => {
    console.log('Shorten endpoint accessed');

    try {
        // Get the raw URL from the query string - this preserves special characters
        const fullUrl = req.url;
        const urlParamIndex = fullUrl.indexOf('url=');

        if (urlParamIndex === -1) {
            console.log('No URL parameter provided');
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        // Extract everything after 'url='
        const originalUrl = decodeURIComponent(fullUrl.slice(urlParamIndex + 4));
        console.log('Decoded URL:', originalUrl);

        // Basic validation - ensure it has a protocol
        if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
            console.log('Invalid URL format - missing protocol');
            return res.status(400).json({ error: 'Invalid URL format - URL must start with http:// or https://' });
        }

        // Generate a short code (8 characters)
        const shortCode = nanoid(8);
        console.log('Generated short code:', shortCode);

        // Store in database
        await pool.query(
            'INSERT INTO shortened_urls (original_url, short_code) VALUES ($1, $2)',
            [originalUrl, shortCode]
        );
        console.log('URL stored in database');

        // Construct the shortened URL
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const shortenedUrl = `${baseUrl}/api/${shortCode}`;
        console.log('Shortened URL:', shortenedUrl);

        res.json({
            original_url: originalUrl,
            shortened_url: shortenedUrl,
            short_code: shortCode
        });

    } catch (error) {
        console.error('Error shortening URL:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// URL redirection endpoint
app.get('/:shortCode', async (req, res) => {
    try {
        const { shortCode } = req.params;
        console.log('Redirect requested for short code:', shortCode);

        // Look up the original URL in the database
        const result = await pool.query(
            'SELECT original_url FROM shortened_urls WHERE short_code = $1',
            [shortCode]
        );

        if (result.rows.length === 0) {
            console.log('Short URL not found:', shortCode);
            return res.status(404).json({ error: 'Short URL not found' });
        }

        const originalUrl = result.rows[0].original_url;
        console.log('Redirecting to:', originalUrl);

        // Redirect to the original URL
        res.redirect(originalUrl);

    } catch (error) {
        console.error('Error redirecting:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
