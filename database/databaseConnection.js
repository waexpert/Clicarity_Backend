const {Pool,types} = require("pg");
require('dotenv').config();

// // Debug: Check if environment variables are loaded
// console.log('DB Configuration:', {
//     user: process.env.DB_USER,
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     password: process.env.DB_PASSWORD ? '***hidden***' : 'MISSING',
//     port: process.env.DB_PORT
// });

// OID for timestamptz = 1184
types.setTypeParser(1184, (value) => value); 
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


pool.on('connect', async (client) => {
    await client.query("SET TIME ZONE 'Asia/Kolkata'");
});

module.exports = pool;
