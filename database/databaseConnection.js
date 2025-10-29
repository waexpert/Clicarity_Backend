const {Pool} = require("pg");
require('dotenv').config();

// // Debug: Check if environment variables are loaded
// console.log('DB Configuration:', {
//     user: process.env.DB_USER,
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     password: process.env.DB_PASSWORD ? '***hidden***' : 'MISSING',
//     port: process.env.DB_PORT
// });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
     rejectUnauthorized: false 
   }
});


module.exports = pool;
