const express = require('express');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const pool = require('../database/databaseConnection');
const router = express.Router();

// POST /mfa/setup - Generates secret & QR code
router.post('/setup', async (req, res) => {
  const userId = req.body.user_id;
  const userEmail = req.body.user_email;

  if (!userId) return res.status(400).json({ error: 'user_id is required' });

  const secret = speakeasy.generateSecret({ name: `Clicarity: ${userEmail}` });
  console.log(secret)
  try {
    // Save the base32 secret to the DB
    await pool.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret.base32, userId]);

    // Generate QR code
    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) return res.status(500).json({ error: 'QR generation failed' });

      res.json({ qr: data_url, secret: secret.base32 });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /mfa/verify - Verify TOTP
router.post('/verify', async (req, res) => {
  const { user_id, token } = req.body;

  if (!user_id || !token) return res.status(400).json({ error: 'user_id and token are required' });

  try {
    const result = await pool.query('SELECT mfa_secret FROM users WHERE id = $1', [user_id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const secret = result.rows[0].mfa_secret;
    console.log(result.rows);
    const isVerified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (isVerified) {
      return res.json({ success: true, message: 'MFA verified' });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;
