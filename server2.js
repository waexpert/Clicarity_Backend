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
const csrf = require('csurf');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

// Route imports
const userRoutes = require('./routes/userRoutes.js');
const userPermissionRoutes = require('./routes/secureRoutes.js');
const mfaRoutes = require('./routes/mfaRoutes.js');
const dataRoutes = require('./routes/dataRoutes.js');
const webhookRoutes = require('./routes/webhookRoutes.js');
const serviceRoutes = require('./routes/serviceRoutes.js');

// Service imports - FIX: Import both router and start functions
const { router: reminderRoutes, startReminderSystem } = require('./utils/reminderService.js');
const { router: birthdayRoutes, startBirthdaySystem } = require('./utils/birthdayService.js');

const moment = require("moment-timezone");
const pool = require("./database/databaseConnection.js");
const PORT = process.env.PORT || 3000;

// FIX 1: Remove redundant body parsers - Express has built-in support
app.use(express.json({ limit: '10mb' })); // Reduced from 50mb for security
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// FIX 2: Configure helmet with proper settings
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false // Adjust based on your needs
}));

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://click.wa.expert'] 
        : ['http://localhost:5173', 'https://click.wa.expert'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// FIX 3: More reasonable rate limiting with different limits for different routes
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Reduced from 10000
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // Very strict for sensitive operations
    message: {
        error: 'Too many requests for this operation, please try again later.',
        retryAfter: '15 minutes'
    }
});

app.use(generalLimiter);

// FIX 4: Add CSRF protection
const csrfProtection = csrf({ 
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
});

// Apply CSRF to state-changing operations
app.use(['/users', '/data', '/secure', '/mfa'], csrfProtection);

// FIX 5: Add input validation and error handling to vendor endpoint
app.get('/getVendors', 
    strictLimiter, // Apply strict rate limiting
    async (req, res) => {
        try {
            // Add basic authentication check
            // if (!req.headers.authorization) {
            //     return res.status(401).json({ error: 'Authentication required' });
            // }
            
            const data = await pool.query(`SELECT id, name, status FROM public.processvendors WHERE active = true`);
            
            res.json({
                success: true,
                data: data.rows,
                count: data.rows.length
            });
        } catch (error) {
            console.error('Error fetching vendors:', error);
            res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Unable to fetch vendors'
            });
        }
    }
);

// FIX 6: Add CSRF token endpoint
app.get('/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Routing with specific rate limiters where needed
app.use('/users', strictLimiter, userRoutes);
app.use('/data', dataRoutes);
app.use('/secure', strictLimiter, userPermissionRoutes);
app.use('/mfa', strictLimiter, mfaRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/service', serviceRoutes);
app.use('/reminder', reminderRoutes);
app.use('/birthday', birthdayRoutes);

// Health check endpoint
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
        timestamp: new Date().toISOString()
    });
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

// FIX 7: Global error handlers
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    
    // Handle CSRF errors
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            error: 'Invalid CSRF token',
            code: 'CSRF_ERROR'
        });
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.details
        });
    }
    
    // Default error response
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

// FIX 8: Improved startup sequence with proper error handling
const startServer = async () => {
    try {
        console.log('🚀 Starting server initialization...');
        
        // Test database connection
        try {
            await pool.query('SELECT 1');
            console.log('✅ Database connection successful');
        } catch (dbError) {
            console.error('❌ Database connection failed:', dbError.message);
            throw new Error('Database connection required for startup');
        }
        
        // Start the server
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
            console.log(`📅 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
        });
        
        // FIX 9: Initialize both reminder and birthday systems
        try {
            console.log('🔄 Initializing background services...');
            
            await Promise.allSettled([
                startReminderSystem().catch(err => {
                    console.error('❌ Reminder system failed to start:', err.message);
                    throw err;
                }),
                startBirthdaySystem().catch(err => {
                    console.error('❌ Birthday system failed to start:', err.message);
                    throw err;
                })
            ]);
            
            console.log('✅ Background services initialized');
            
        } catch (serviceError) {
            console.error('⚠️ Some background services failed to start:', serviceError.message);
            console.log('🔄 Server continues to run. Services will retry connection.');
        }
        
        // Graceful shutdown handlers
        const gracefulShutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            
            server.close(async () => {
                try {
                    await pool.end();
                    console.log('✅ Database connections closed');
                    console.log('✅ Server shutdown complete');
                    process.exit(0);
                } catch (error) {
                    console.error('❌ Error during shutdown:', error);
                    process.exit(1);
                }
            });
            
            // Force shutdown after 30 seconds
            setTimeout(() => {
                console.error('❌ Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
    } catch (error) {
        console.error("❌ Failed to initialize server:", error);
        process.exit(1);
    }
};

// FIX 10: Enhanced error handling for unhandled events
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately, log and continue
});

process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    // For uncaught exceptions, it's safer to exit
    process.exit(1);
});

// Start the server
startServer();