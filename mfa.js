const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// // Generate a secret key for the user
const secret = speakeasy.generateSecret({ name: 'MyApp (user@example.com)' });

console.log('Secret base32:', secret.base32); // store this securely per user

// Generate QR code for authenticator apps
qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
  if (err) {
    console.error('Error generating QR code', err);
  } else {
    console.log('Scan this QR code in your authenticator app:', data_url);
  }
});



// Example function to verify TOTP
function verifyToken(userToken, userSecret) {
  const isVerified = speakeasy.totp.verify({
    secret: userSecret,
    encoding: 'base32',
    token: userToken,
    window: 1, // allow 30s before and after
  });

  return isVerified;
}

// Example usage
const userInput = '170807'; // input from the user
const storedSecret = 'HRRTOIZDJNKTQULXERHSSXLDLAXFA6Z6PF2XIQK3IFWDMXK2NVFQ';

if (verifyToken(userInput, storedSecret)) {
  console.log('✅ MFA token verified!');
} else {
  console.log('❌ Invalid MFA token');
}
