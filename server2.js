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
// const {router:reminderRoutes , startReminderSystem } = require('./utils/reminderService.js')
// const {router:birthdayRoutes} = require('./utils/birthdayService.js')
// const bodyParser = require("body-parser");
// const moment = require("moment-timezone");
// const pool = require("./database/databaseConnection.js");
// const PORT = process.env.PORT || 3000;

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
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
// app.use('/users', userRoutes);
// app.use('/data', dataRoutes);
// app.use('/secure', userPermissionRoutes);
// app.use('/mfa', mfaRoutes);
// app.use('/webhooks',webhookRoutes);
// app.use('/service',serviceRoutes);
// app.use('/reminder',reminderRoutes);
// app.use('/birthday',birthdayRoutes);

// app.get('/', (req, res) => {
//     res.send("API is working");
// });

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
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// Route imports
const userRoutes = require('./routes/userRoutes.js');
const userPermissionRoutes = require('./routes/secureRoutes.js');
const mfaRoutes = require('./routes/mfaRoutes.js');
const dataRoutes = require('./routes/dataRoutes.js');
const webhookRoutes = require('./routes/webhookRoutes.js');
const serviceRoutes = require('./routes/serviceRoutes.js');

// Service imports
console.log('🔍 Importing birthday and reminder services...');

try {
    const reminderService = require('./utils/reminderService.js');
    console.log('✅ Reminder service imported');
    
    const birthdayService = require('./utils/birthdayService.js');
    console.log('✅ Birthday service imported');
    
    // Extract router and start functions
    const { router: reminderRoutes, startReminderSystem } = reminderService;
    const { router: birthdayRoutes, startBirthdaySystem } = birthdayService;
    
    console.log('✅ All services extracted successfully');
    
} catch (importError) {
    console.error('❌ Error importing services:', importError);
    process.exit(1);
}

const moment = require("moment-timezone");
const pool = require("./database/databaseConnection.js");
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Simplified helmet for debugging
app.use(helmet({ 
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false 
}));

// CORS configuration
const corsOptions = {
    origin: ['http://localhost:5173', 'https://click.wa.expert', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Basic rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Too many requests' }
});
app.use(generalLimiter);

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Server is working', 
        timestamp: new Date().toISOString() 
    });
});

// Register routes
console.log('🔍 Registering routes...');

try {
    // Import again to ensure fresh references
    const { router: reminderRoutes, startReminderSystem } = require('./utils/reminderService.js');
    const { router: birthdayRoutes, startBirthdaySystem } = require('./utils/birthdayService.js');
    
    // Register all routes
    app.use('/users', userRoutes);
    console.log('✅ User routes registered');
    
    app.use('/data', dataRoutes);
    console.log('✅ Data routes registered');
    
    app.use('/secure', userPermissionRoutes);
    console.log('✅ Secure routes registered');
    
    app.use('/mfa', mfaRoutes);
    console.log('✅ MFA routes registered');
    
    app.use('/webhooks', webhookRoutes);
    console.log('✅ Webhook routes registered');
    
    app.use('/service', serviceRoutes);
    console.log('✅ Service routes registered');
    
    app.use('/reminder', reminderRoutes);
    console.log('✅ Reminder routes registered at /reminder');
    
    app.use('/birthday', birthdayRoutes);
    console.log('✅ Birthday routes registered at /birthday');
    
    console.log('✅ All routes registered successfully');
    
} catch (routeError) {
    console.error('❌ Error registering routes:', routeError);
    console.error('❌ Stack trace:', routeError.stack);
    process.exit(1);
}

// Add vendor endpoint (fixed)
app.get('/getVendors', async (req, res) => {
    try {
        const data = await pool.query(`SELECT * FROM public.processvendors;`);
        res.json({
            success: true,
            data: data.rows
        });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch vendors'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/', (req, res) => {
    res.json({
        message: "API is working",
        version: "1.0.0",
        availableEndpoints: [
            'GET /',
            'GET /health',
            'GET /test',
            'GET /getVendors',
            'POST /birthday/add',
            'GET /birthday/list',
            'GET /birthday/today',
            'POST /reminder/add',
            'GET /reminder/list'
        ],
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Global error:', err);
    res.status(err.status || 500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        suggestion: 'Check the available endpoints at GET /',
        timestamp: new Date().toISOString()
    });
});

// Startup function
const startServer = async () => {
    try {
        console.log('🚀 Starting server...');
        
        // Test database connection
        try {
            await pool.query('SELECT NOW()');
            console.log('✅ Database connection successful');
        } catch (dbError) {
            console.error('❌ Database connection failed:', dbError.message);
            console.log('⚠️ Continuing without database connection...');
        }
        
        // Start server first
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
            console.log(`📍 Test the birthday API:`);
            console.log(`   curl -X POST http://localhost:${PORT}/birthday/add \\`);
            console.log(`        -H "Content-Type: application/json" \\`);
            console.log(`        -d '{"name":"Test","phone":"123","birthday_date":"1990-01-01","sender_name":"Admin","sender_phone":"456","special_day":"Birthday"}'`);
        });
        
        // Initialize background services after server starts
        setTimeout(async () => {
            try {
                console.log('🔄 Starting background services...');
                
                const { startReminderSystem } = require('./utils/reminderService.js');
                const { startBirthdaySystem } = require('./utils/birthdayService.js');
                
                await Promise.allSettled([
                    startReminderSystem().catch(err => {
                        console.error('❌ Reminder system failed:', err.message);
                    }),
                    startBirthdaySystem().catch(err => {
                        console.error('❌ Birthday system failed:', err.message);
                    })
                ]);
                
                console.log('✅ Background services initialization completed');
                
            } catch (serviceError) {
                console.error('❌ Service initialization error:', serviceError.message);
                console.log('🔄 Server continues without background services');
            }
        }, 2000); // Wait 2 seconds after server starts
        
        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down...`);
            
            server.close(async () => {
                try {
                    await pool.end();
                    console.log('✅ Server shutdown complete');
                    process.exit(0);
                } catch (error) {
                    console.error('❌ Error during shutdown:', error);
                    process.exit(1);
                }
            });
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
    } catch (error) {
        console.error("❌ Server startup failed:", error);
        process.exit(1);
    }
};

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    process.exit(1);
});

// Start the server
startServer();