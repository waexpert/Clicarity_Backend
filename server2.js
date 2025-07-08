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

// Service imports - ADD DEBUG LOGGING
console.log('🔍 Importing birthday and reminder services...');

try {
    const reminderService = require('./utils/reminderService.js');
    console.log('✅ Reminder service imported:', typeof reminderService);
    console.log('📊 Reminder service exports:', Object.keys(reminderService));
    
    const birthdayService = require('./utils/birthdayService.js');
    console.log('✅ Birthday service imported:', typeof birthdayService);
    console.log('📊 Birthday service exports:', Object.keys(birthdayService));
    
    // Extract router and start functions
    const { router: reminderRoutes, startReminderSystem } = reminderService;
    const { router: birthdayRoutes, startBirthdaySystem } = birthdayService;
    
    console.log('📊 Reminder router type:', typeof reminderRoutes);
    console.log('📊 Birthday router type:', typeof birthdayRoutes);
    console.log('📊 Start reminder function:', typeof startReminderSystem);
    console.log('📊 Start birthday function:', typeof startBirthdaySystem);
    
} catch (importError) {
    console.error('❌ Error importing services:', importError);
    console.error('❌ Stack trace:', importError.stack);
    process.exit(1);
}

const moment = require("moment-timezone");
const pool = require("./database/databaseConnection.js");
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(helmet({ contentSecurityPolicy: false })); // Simplified for debugging

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://click.wa.expert'] 
        : ['http://localhost:5173', 'https://click.wa.expert', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Basic rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Increased for debugging
    message: { error: 'Too many requests' }
});
app.use(generalLimiter);

// Test endpoint to verify server is working
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Server is working', 
        timestamp: new Date().toISOString() 
    });
});

// Register routes with debug logging
console.log('🔍 Registering routes...');

try {
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
    
    // Register reminder and birthday routes
    const { router: reminderRoutes, startReminderSystem } = require('./utils/reminderService.js');
    const { router: birthdayRoutes, startBirthdaySystem } = require('./utils/birthdayService.js');
    
    app.use('/reminder', reminderRoutes);
    console.log('✅ Reminder routes registered at /reminder');
    
    app.use('/birthday', birthdayRoutes);
    console.log('✅ Birthday routes registered at /birthday');
    
    // List all registered routes for debugging
    console.log('🔍 All registered routes:');
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            console.log(`  ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
        } else if (middleware.name === 'router') {
            console.log(`  Router middleware: ${middleware.regexp}`);
            if (middleware.handle && middleware.handle.stack) {
                middleware.handle.stack.forEach((route) => {
                    if (route.route) {
                        const methods = Object.keys(route.route.methods).join(', ').toUpperCase();
                        console.log(`    ${methods} ${middleware.regexp.source.replace('\\/?(?=\\/|$)', '')}${route.route.path}`);
                    }
                });
            }
        }
    });
    
} catch (routeError) {
    console.error('❌ Error registering routes:', routeError);
    console.error('❌ Stack trace:', routeError.stack);
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        routes: {
            birthday: app._router.stack.some(layer => 
                layer.regexp.source.includes('birthday')
            ),
            reminder: app._router.stack.some(layer => 
                layer.regexp.source.includes('reminder')
            )
        }
    });
});

app.get('/', (req, res) => {
    res.json({
        message: "API is working",
        availableRoutes: [
            'GET /health',
            'GET /test',
            'POST /birthday/add',
            'GET /birthday/list',
            'POST /reminder/add',
            'GET /reminder/list'
        ]
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('❌ Global error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        availableRoutes: [
            'GET /',
            'GET /health',
            'GET /test',
            'POST /birthday/add',
            'GET /birthday/list'
        ]
    });
});

// Startup function
const startServer = async () => {
    try {
        console.log('🚀 Starting server...');
        
        // Test database connection
        try {
            await pool.query('SELECT 1');
            console.log('✅ Database connection successful');
        } catch (dbError) {
            console.error('❌ Database connection failed:', dbError.message);
            // Don't exit, continue without DB for route testing
        }
        
        // Start server
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
            console.log(`📍 Test the API:`);
            console.log(`   GET  http://localhost:${PORT}/`);
            console.log(`   GET  http://localhost:${PORT}/health`);
            console.log(`   POST http://localhost:${PORT}/birthday/add`);
        });
        
        // Initialize services
        try {
            console.log('🔄 Starting background services...');
            
            if (typeof startReminderSystem === 'function') {
                await startReminderSystem();
                console.log('✅ Reminder system started');
            } else {
                console.log('⚠️ Reminder system start function not available');
            }
            
            if (typeof startBirthdaySystem === 'function') {
                await startBirthdaySystem();
                console.log('✅ Birthday system started');
            } else {
                console.log('⚠️ Birthday system start function not available');
            }
            
        } catch (serviceError) {
            console.error('❌ Service initialization error:', serviceError);
            console.log('🔄 Server continues without background services');
        }
        
    } catch (error) {
        console.error("❌ Server startup failed:", error);
        process.exit(1);
    }
};

// Start the server
startServer();