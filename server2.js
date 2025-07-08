require("dotenv").config();
const express = require("express");
const app = express();
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const userRoutes = require('./routes/userRoutes.js');
const userPermissionRoutes = require('./routes/secureRoutes.js')
const mfaRoutes = require('./routes/mfaRoutes.js')
const dataRoutes = require('./routes/dataRoutes.js')
const webhookRoutes = require('./routes/webhookRoutes.js')
const serviceRoutes = require('./routes/serviceRoutes.js')
const bodyParser = require("body-parser");
const moment = require("moment-timezone");
const pool = require("./database/databaseConnection.js");
const PORT = process.env.PORT || 3000;

// Express middleware setup
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(helmet());
app.get('/getVendors',async(req,res)=>{
    const data = await pool.query(`SELECT * FROM public.processvendors;`)
    res.send({data : data.rows});
})

// CORS configuration
const corsOptions = {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting
app.use(rateLimit({
   windowMs: 15 * 60 * 1000, // 15 min
   max: 10000,
   message: 'Too many requests, please try again later'
}));

// Routing
app.use('/users', userRoutes);
app.use('/data', dataRoutes);
app.use('/secure', userPermissionRoutes);
app.use('/mfa', mfaRoutes);
app.use('/webhooks',webhookRoutes);
app.use('/service',serviceRoutes)

app.get('/', (req, res) => {
    res.send("API is working");
});

// Configure URL shortener query parsing
app.set('query parser', (str) => {
    const result = new URLSearchParams(str);
    const params = {};
    for (const [key, value] of result) {
        params[key] = value;
    }
    return params;
});

// Improved startup sequence
const startServer = async () => {
    try {
        // // Initialize URL shortening database
        // await initDatabase();
        
        // Start the server first
        const server = app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`, new Date());
            console.log("📅 Task reminder system started...");
        });
        
        // Connect to RabbitMQ first before processing tasks
        // try {
        //     console.log("Connecting to RabbitMQ...");
            
        //     // Connect to RabbitMQ and wait for connection to establish
        //     await connectRabbitMQ();
            
        //     // Now that RabbitMQ is connected, check if we need to run task processor
        //     const now = moment().tz("Asia/Kolkata");
        //     if (now.hour() >= 10) {
        //         console.log("Starting initial task check across all schemas...");
        //         await loadAllTasksDueToday();
        //     } else {
        //         console.log(`Waiting until 10:00 AM IST for scheduled task processing (current time: ${now.format("HH:mm")})`);
        //     }
        // } catch (error) {
        //     console.error("❌ RabbitMQ connection failed:", error.message);
        //     console.log("Server continues to run without RabbitMQ. Will retry connection periodically.");
        // }
    } catch (error) {
        console.error("❌ Failed to initialize server:", error);
        process.exit(1);
    }
};

//Add global error handler to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
