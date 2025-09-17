// require("dotenv").config();
// const express = require("express");
// const app = express();
// const cookieParser = require('cookie-parser');
// const csrf = require('csurf');
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
// const cors = require('cors');
// const { body, validationResult } = require('express-validator');
// const userRoutes = require('./routes/userRoutes.js');
// const userPermissionRoutes = require('./routes/secureRoutes.js')
// const mfaRoutes = require('./routes/mfaRoutes.js')
// const dataRoutes = require('./routes/dataRoutes.js')
// const webhookRoutes = require('./routes/webhookRoutes.js')
// const serviceRoutes = require('./routes/serviceRoutes.js')
// const referenceRoutes = require('./routes/referenceRoutes.js')
// const { 
//     router: paymentReminderRoutes, 
//     startReminderSystem: startPaymentReminderSystem, 
//     processDueReminders: processPaymentReminders,
//     processOverdueReminders,
//     gracefulShutdown: shutdownPaymentReminders
// } = require('./utils/paymentService.js')
// const {router:reminderRoutes , startReminderSystem,processDueReminders } = require('./utils/reminderService.js')
// const {router:birthdayRoutes,startBirthdaySystem,processTodaysBirthdays} = require('./utils/birthdayService.js')
// const bodyParser = require("body-parser");
// const moment = require("moment-timezone");
// const pool = require("./database/databaseConnection.js");
// const PORT = process.env.PORT || 3000;
// const apiKeyAuth = require("./middlewares/apiKeyAuth.js")

// // Express middleware setup
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());
// app.use(cookieParser());
// app.use(helmet());
// app.get('/getVendors',async(req,res)=>{
//     const data = await pool.query(`SELECT * FROM public.processvendors;`)
//     res.send({data : data.rows});
// })

// // CORS configuration
// const corsOptions = {
//     origin: ['http://localhost:5173','https://click.wa.expert'],
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
//     credentials: true,
// };
// app.use(cors(corsOptions));

// // Rate limiting
// app.use(rateLimit({
//    windowMs: 15 * 60 * 1000, // 15 min
//    max: 10000,
//    message: 'Too many requests, please try again later'
// }));

// // Routing
// app.get('/', (req, res) => {
//     res.send("API is working");
// });
// // app.use(apiKeyAuth);
// app.use('/users', userRoutes);
// app.use('/data', dataRoutes);
// app.use('/secure', userPermissionRoutes);
// app.use('/mfa', mfaRoutes);
// app.use('/webhooks',webhookRoutes);
// app.use('/service',serviceRoutes);
// app.use('/reminder',reminderRoutes);
// app.use('/birthday',birthdayRoutes);
// app.use('/payment-reminders', paymentReminderRoutes);
// app.use('/reference',referenceRoutes);


// // Configure URL shortener query parsing
// app.set('query parser', (str) => {
//     const result = new URLSearchParams(str);
//     const params = {};
//     for (const [key, value] of result) {
//         params[key] = value;
//     }
//     return params;
// });

// // Improved startup sequence
// const startServer = async () => {
//     try {
//         // // Initialize URL shortening database
//         // await initDatabase();
        
//         // Start the server first
//         const server = app.listen(PORT, () => {
//             console.log(`Server running at http://localhost:${PORT}`, new Date());
//             console.log("📅 Task reminder system started...");
//             startReminderSystem();
//             startBirthdaySystem();
//             processTodaysBirthdays();
//             processDueReminders();

//             startPaymentReminderSystem();
//             processPaymentReminders();
//         });
        
//         // Connect to RabbitMQ first before processing tasks
//         // try {
//         //     console.log("Connecting to RabbitMQ...");
            
//         //     // Connect to RabbitMQ and wait for connection to establish
//         //     await connectRabbitMQ();
            
//         //     // Now that RabbitMQ is connected, check if we need to run task processor
//         //     const now = moment().tz("Asia/Kolkata");
//         //     if (now.hour() >= 10) {
//         //         console.log("Starting initial task check across all schemas...");
//         //         await loadAllTasksDueToday();
//         //     } else {
//         //         console.log(`Waiting until 10:00 AM IST for scheduled task processing (current time: ${now.format("HH:mm")})`);
//         //     }
//         // } catch (error) {
//         //     console.error("❌ RabbitMQ connection failed:", error.message);
//         //     console.log("Server continues to run without RabbitMQ. Will retry connection periodically.");
//         // }
//     } catch (error) {
//         console.error("❌ Failed to initialize server:", error);
//         process.exit(1);
//     }
// };

// //Add global error handler to prevent crashes
// process.on('unhandledRejection', (reason, promise) => {
//     console.error('Unhandled Rejection at:', promise, 'reason:', reason);
// });

// startServer();


require("dotenv").config();
const express = require("express");
const app = express();
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

// Import existing routes
const userRoutes = require('./routes/userRoutes.js');
const userPermissionRoutes = require('./routes/secureRoutes.js')
const mfaRoutes = require('./routes/mfaRoutes.js')
const dataRoutes = require('./routes/dataRoutes.js')
const webhookRoutes = require('./routes/webhookRoutes.js')
const serviceRoutes = require('./routes/serviceRoutes.js')
const referenceRoutes = require('./routes/referenceRoutes.js')

// Import payment reminder service
const { 
    router: paymentReminderRoutes, 
    startReminderSystem: startPaymentReminderSystem, 
    processDueReminders: processPaymentReminders,
    processOverdueReminders,
    gracefulShutdown: shutdownPaymentReminders
} = require('./utils/paymentService.js')

// Import other services
const {router:reminderRoutes , startReminderSystem,processDueReminders } = require('./utils/reminderService.js')
const {router:birthdayRoutes,startBirthdaySystem,processTodaysBirthdays} = require('./utils/birthdayService.js')

// Import NEW task service
const taskService = require('./utils/taskService.js');
const taskRoutes = require('./routes/taskRoutes.js');

const bodyParser = require("body-parser");
const moment = require("moment-timezone");
const pool = require("./database/databaseConnection.js");
const PORT = process.env.PORT || 3000;
const apiKeyAuth = require("./middlewares/apiKeyAuth.js")

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
    origin: ['http://localhost:5173','https://click.wa.expert'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
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
app.get('/', (req, res) => {
    res.send("API is working");
});

// Existing routes
app.use('/users', userRoutes);
app.use('/data', dataRoutes);
app.use('/secure', userPermissionRoutes);
app.use('/mfa', mfaRoutes);
app.use('/webhooks',webhookRoutes);
app.use('/service',serviceRoutes);
app.use('/reminder',reminderRoutes);
app.use('/birthday',birthdayRoutes);
app.use('/payment-reminders', paymentReminderRoutes);
app.use('/reference',referenceRoutes);


// POST /api/contacts/batch-update
app.post('/contacts/replace-all', async (req, res) => {
    const { schemaName, tableName, contacts } = req.body;
    
    // Debug logging
    console.log('Request body:', req.body);
    console.log('Contacts array:', contacts);
    console.log('Contacts length:', contacts ? contacts.length : 'undefined');
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Truncate table
        console.log(`Truncating table ${schemaName}.${tableName}`);
        await client.query(`TRUNCATE TABLE ${schemaName}.${tableName}`);
        
        // Check if contacts array exists and has data
        if (!contacts || !Array.isArray(contacts)) {
            throw new Error('No contacts array provided');
        }
        
        if (contacts.length === 0) {
            console.log('No contacts to insert');
            await client.query('COMMIT');
            return res.json({ success: true, count: 0, message: 'Table truncated, no data to insert' });
        }
        
        // Insert contacts one by one with logging
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            console.log(`Inserting contact ${i + 1}:`, contact);
            
            await client.query(
                `INSERT INTO ${schemaName}.${tableName} (name, email, phone) VALUES ($1, $2, $3)`,
                [contact.name || '', contact.email || '', contact.phone || '']
            );
        }
        
        await client.query('COMMIT');
        console.log(`Successfully inserted ${contacts.length} contacts`);
        res.json({ success: true, count: contacts.length });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in replace-all:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});
// NEW: Task routes
app.use('/tasks', taskRoutes);

// Configure URL shortener query parsing
app.set('query parser', (str) => {
    const result = new URLSearchParams(str);
    const params = {};
    for (const [key, value] of result) {
        params[key] = value;
    }
    return params;
});

// Initialize task service with database pool
const initializeServices = async () => {
    try {
        // Initialize task service with database pool
        taskService.initializeTaskService(pool);
        console.log('✅ Task service initialized');
        
        // Start task reminder system
        await taskService.startTaskReminderSystem();
        console.log('✅ Task reminder system started');
        
    } catch (error) {
        console.error('❌ Error initializing task service:', error);
    }
};

// Improved startup sequence
const startServer = async () => {
    try {
        // Start the server first
        const server = app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`, new Date());
            console.log("📅 Starting all reminder systems...");
            
            // Initialize existing services
            startReminderSystem();
            startBirthdaySystem();
            processTodaysBirthdays();
            processDueReminders();
            startPaymentReminderSystem();
            processPaymentReminders();
            
            // Initialize NEW task service
            initializeServices();
        });
        
        // Handle graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down gracefully');
            try {
                await shutdownPaymentReminders();
                console.log('✅ All services shut down gracefully');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        });

        process.on('SIGINT', async () => {
            console.log('SIGINT received, shutting down gracefully');
            try {
                await shutdownPaymentReminders();
                console.log('✅ All services shut down gracefully');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        });
        
    } catch (error) {
        console.error("❌ Failed to initialize server:", error);
        process.exit(1);
    }
};

// Add global error handler to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

startServer();


