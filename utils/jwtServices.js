// const jwt = require("jsonwebtoken");

// exports.sendJWTToken = (user, statusCode, res) => {
//     const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
//         expiresIn: process.env.JWT_EXPIRE
//     });

//     const cookieOptions = {
//         expires: new Date(
//             Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
//         ),
//         httpOnly: true
//     };

//     res.status(statusCode).cookie("token", token, cookieOptions).json({
//         success: true,
//         token
//     });
// }

const jwt = require("jsonwebtoken");

exports.sendJWTToken = (user, statusCode, res) => {
  const payload = { id: user.id, email: user.email };

  const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });

  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

  // Set tokens in HTTP-only cookies
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: true, // set to true in production
    sameSite: "Strict",
    maxAge: 15 * 60 * 1000, // 15 min
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(statusCode).json({
    success: true,
    user: user,
  });
};

