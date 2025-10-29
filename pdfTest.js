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
// const bodyParser = require("body-parser");
// const cron = require("node-cron");
// const axios = require("axios");
// const moment = require("moment-timezone");
// const amqp = require("amqplib");
// const { v4: uuidv4 } = require('uuid');
// const { nanoid } = require('nanoid');
// const fs = require('fs');
// const path = require('path');
// const PDFDocument = require('pdfkit');
// const archiver = require('archiver');
// // AWS SDK v3 imports
// const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
// const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// // Use the pool from the existing connection to maintain consistency
// const pool = require("./database/databaseConnection.js");

// // Configure AWS SDK v3
// const s3Client = new S3Client({
//   region: 'eu-north-1', // Your region
//   credentials: {
//     accessKeyId: process.env.ACCESS_KEY,
//     secretAccessKey: process.env.SECRET_ACCESS_KEY,
//   },
// });

// const PORT = process.env.PORT || 3000;

// // Express middleware setup
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());
// app.use(cookieParser());
// app.use(helmet());

// // CORS configuration
// const corsOptions = {
//     origin: 'http://localhost:5173',
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     credentials: true,
// };
// app.use(cors(corsOptions));

// // Rate limiting
// app.use(rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 min
//     max: 100,
//     message: 'Too many requests, please try again later'
// }));

// // RabbitMQ setup
// let channel; // RabbitMQ channel
// const QUEUE_NAME = 'task_reminder_queue';

// // Connect to RabbitMQ
// // Connect to RabbitMQ - returns a promise
// async function connectRabbitMQ() {
//     return new Promise(async (resolve, reject) => {
//         try {
//             // Connect to RabbitMQ server
//             const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
//             console.log('🐰 Connected to RabbitMQ');

//             // Create a channel
//             channel = await connection.createChannel();

//             // Make sure queue exists with persistence enabled
//             await channel.assertQueue(QUEUE_NAME, {
//                 durable: true // Queue survives broker restart
//             });

//             console.log(`🔄 RabbitMQ queue "${QUEUE_NAME}" created/confirmed`);

//             // Set up consumer for the queue
//             await consumeTasks();
            
//             // Connection successful
//             resolve(connection);
//         } catch (error) {
//             console.error('❌ Error connecting to RabbitMQ:', error);
            
//             // Start retry process but don't wait for it
//             setTimeout(() => {
//                 connectRabbitMQ().catch(err => {
//                     console.error("Reconnection attempt failed:", err.message);
//                 });
//             }, 5000);
            
//             // Reject the promise so the caller knows the connection failed
//             reject(error);
//         }
//     });
// }

// // Function to get today's date in YYYY-MM-DD format
// function getTodayDate() {
//     return moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
// }

// // Function to discover all "tasks" tables across all schemas
// async function discoverTaskTables() {
//     try {
//         // Query to find all schemas and their tables named "tasks"
//         const query = `
//             SELECT 
//                 n.nspname AS schema_name,
//                 c.relname AS table_name
//             FROM 
//                 pg_catalog.pg_class c
//             JOIN 
//                 pg_catalog.pg_namespace n ON n.oid = c.relnamespace
//             WHERE 
//                 c.relname = 'tasks'
//                 AND c.relkind = 'r'    -- Only regular tables (r = relation)
//                 AND n.nspname NOT IN ('pg_catalog', 'information_schema')  -- Exclude system schemas
//             ORDER BY 
//                 schema_name;
//         `;

//         const { rows } = await pool.query(query);
//         console.log(`📊 Found ${rows.length} "tasks" tables across different schemas`);
//         return rows;
//     } catch (error) {
//         console.error("❌ Error discovering task tables:", error);
//         return []; // Return empty array instead of failing
//     }
// }

// // Function to load tasks due today and queue them in RabbitMQ (original function)
// const loadTasksDueToday = async () => {
//     try {
//         const today = getTodayDate();
//         console.log(`🕒 Fetching tasks due on ${today}`);

//         const { rows } = await pool.query(
//             `SELECT * FROM danger.tasks WHERE due_date::date = $1 AND processed = false`,
//             [today]
//         );

//         console.log(`✅ Found ${rows.length} tasks due today to queue`);

//         // Queue each task in RabbitMQ
//         for (const task of rows) {
//             await queueTask(task);

//             // Mark as processed in database
//             await pool.query(
//                 "UPDATE danger.tasks SET processed = true WHERE id = $1",
//                 [task.id]
//             );
//         }
//     } catch (error) {
//         console.error("❌ Error loading tasks due today:", error);
//     }
// };

// // Function to load all tasks due today from all discovered tables
// async function loadAllTasksDueToday() {
//     try {
//         const today = getTodayDate();
//         console.log(`🕒 Fetching tasks due on ${today} from all schemas`);

//         // Discover all tasks tables
//         const taskTables = await discoverTaskTables();
//         let totalTasksQueued = 0;

//         // Process each discovered table
//         for (const tableInfo of taskTables) {
//             const { schema_name, table_name } = tableInfo;

//             console.log(`🔍 Checking ${schema_name}.${table_name} for due tasks`);

//             // Query for tasks due today
//             const query = `SELECT * FROM "${schema_name}"."${table_name}" WHERE due_date::date = $1 AND processed = false`;
//             const { rows: tasks } = await pool.query(query, [today]);

//             console.log(`✅ Found ${tasks.length} tasks due today in ${schema_name}.${table_name}`);

//             // Queue each task with schema information
//             for (const task of tasks) {
//                 // Add schema and table info to the task
//                 const enrichedTask = {
//                     ...task,
//                     schema_name,
//                     table_name
//                 };

//                 await queueTask(enrichedTask);

//                 // Mark as processed in database
//                 await pool.query(
//                     `UPDATE "${schema_name}"."${table_name}" SET processed = true WHERE id = $1`,
//                     [task.id]
//                 );

//                 totalTasksQueued++;
//             }
//         }

//         console.log(`🎉 Total tasks queued across all schemas: ${totalTasksQueued}`);
//         return totalTasksQueued;
//     } catch (error) {
//         console.error("❌ Error loading tasks due today from all schemas:", error);
//         return 0; // Return 0 instead of crashing
//     }
// }

// // Function to queue a task in RabbitMQ
// // Function to queue a task in RabbitMQ
// const queueTask = async (task) => {
//     try {
//         // Check if RabbitMQ channel is established
//         if (!channel) {
//             console.error("❌ RabbitMQ channel not established, will retry connecting");
            
//             try {
//                 // Try to connect to RabbitMQ
//                 await connectRabbitMQ();
//             } catch (connErr) {
//                 console.error("❌ Failed to connect to RabbitMQ:", connErr.message);
//                 throw new Error("RabbitMQ connection failed");
//             }
            
//             // If we still don't have a channel, throw an error
//             if (!channel) {
//                 throw new Error("RabbitMQ channel still not established after connection attempt");
//             }
//         }

//         // Add message to queue
//         const message = {
//             ...task,
//             enqueuedAt: new Date().getTime()
//         };

//         // Send to main queue
//         channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
//             persistent: true
//         });

//         console.log(`⚡ Queued task "${task.task_name}" for processing`);
//         return true;
//     } catch (error) {
//         console.error("❌ Error queuing task:", error.message);
//         throw error; // Re-throw so the caller knows it failed
//     }
// };

// //smplified PDF generation function
// async function generateSimplePdf(tasks) {
//   try {
//     // Get the first task's assigned_to as the filename
//     const employeeName = tasks[0].assigned_to;
//     const filename = `${employeeName.replace(/\s+/g, '_')}_Tasks.pdf`;
    
//     // Create PDF document
//     const pdfDoc = new PDFDocument({
//       margin: 20,
//       size: 'A4',
//       layout: 'portrait'
//     });
    
//     // Set up file writing
//     const writeStream = fs.createWriteStream(filename);
//     pdfDoc.pipe(writeStream);

//     // Add simple content - you can keep your existing PDF generation code here
//     pdfDoc.fontSize(24)
//       .font('Helvetica-Bold')
//       .text('Tasks Report', {
//         align: 'center'
//       });

//     pdfDoc.moveDown(1);

//     pdfDoc.fontSize(14)
//       .font('Helvetica')
//       .text(`Tasks for: ${employeeName}`, {
//         align: 'left'
//       });

//     pdfDoc.moveDown(1);

//     // Add tasks in a simple table
//     tasks.forEach((task, index) => {
//       pdfDoc.fontSize(12)
//         .text(`${index + 1}. ${task.task_name}`, {
//           continued: false
//         });
      
//       pdfDoc.fontSize(10)
//         .text(`Due Date: ${new Date(task.due_date).toLocaleDateString()}`, {
//           indent: 20
//         });
      
//       pdfDoc.fontSize(10)
//         .text(`Notes: ${task.notes || 'None'}`, {
//           indent: 20
//         });
      
//       pdfDoc.moveDown(0.5);
//     });

//     // End the PDF creation
//     pdfDoc.end();

//     // Wait for the PDF to be written
//     await new Promise((resolve, reject) => {
//       writeStream.on('finish', resolve);
//       writeStream.on('error', reject);
//     });

//     console.log(`Created PDF: ${filename}`);

//     // Upload to S3
//     try {
//       const fileContent = fs.readFileSync(filename);
//       const s3Key = `employee-tasks/${filename}`;

//       const params = {
//         Bucket: process.env.S3_BUCKET_NAME,
//         Key: s3Key,
//         Body: fileContent,
//         ContentType: 'application/pdf',
//       };

//       // Upload file using v3 SDK
//       const command = new PutObjectCommand(params);
//       await s3Client.send(command);

//       console.log(`Uploaded ${filename} to S3: ${s3Key}`);

//       // Generate signed URL
//       const getCommand = new GetObjectCommand({
//         Bucket: process.env.S3_BUCKET_NAME,
//         Key: s3Key
//       });

//       const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 259200 }); // 3 days
//       console.log(`Generated signed URL: ${url}`);

//       // Clean up the local file
//       fs.unlinkSync(filename);

//       return url;
//     } catch (error) {
//       console.error("Error uploading PDF to S3:", error);
//       throw error;
//     }
//   } catch (error) {
//     console.error("Error generating PDF:", error);
//     throw error;
//   }
// }

// // Function to generate PDF for a task - SIMPLIFIED
// const generatePdfForTask = async (task) => {
//   try {
//     // Extract schema and table information from the task
//     const schema_name = task.schema_name || 'danger'; 
//     const table_name = task.table_name || 'tasks';    

//     console.log(`Generating PDF for task: ${task.task_name} assigned to ${task.assigned_to}`);

//     // Get all tasks for this assigned person (without the processed=false condition)
//     const { rows } = await pool.query(
//       `SELECT * FROM "${schema_name}"."${table_name}" 
//        WHERE assigned_to = $1`,
//       [task.assigned_to]
//     );

//     console.log(`Found ${rows.length} tasks for ${task.assigned_to} in ${schema_name}.${table_name}`);

//     // Check if tasks were found
//     if (rows.length === 0) {
//       console.log(`No tasks found for ${task.assigned_to}`);
//       throw new Error(`No tasks found for ${task.assigned_to}`);
//     }

//     // Use direct API call instead of trying to generate PDF locally
//     console.log(`Calling API to generate PDF for ${task.assigned_to}`);
    
//     // Use axios with a timeout to prevent hanging
//     const response = await axios.get(
//       `https://click.wa.expert/api/generatePdf?schemaName=${schema_name}&tableName=${table_name}&assignedTo=${task.assigned_to}`,
//       { timeout: 10000 } // 10 second timeout
//     );
    
//     // Check if we got a valid response with download URL
//     if (!response.data || !response.data.downloadUrl) {
//       throw new Error('API did not return a valid download URL');
//     }
    
//     console.log(`📄 PDF URL received for ${task.assigned_to}: ${response.data.downloadUrl}`);
    
//     // No need to shorten URL if we're having issues - just return the URL directly
//     return response.data.downloadUrl;
//   } catch (error) {
//     console.error("❌ Error generating PDF:", error.message);
    
//     // If we can't generate a PDF, create a placeholder URL that still works
//     const fallbackUrl = `https://click.wa.expert/no-pdf-available?assignedTo=${encodeURIComponent(task.assigned_to)}`;
//     console.log(`⚠️ Using fallback URL: ${fallbackUrl}`);
    
//     return fallbackUrl;
//   }
// };

// // Function to shorten URLs
// const shortenUrl = async (url) => {
//     try {
//         // Ensure URL is encoded properly
//         const encodedUrl = encodeURIComponent(url);

//         // Use axios with a timeout to prevent hanging
//         const response = await axios.get(
//             `https://click.wa.expert/api/sh?url=${encodedUrl}`,
//             { timeout: 5000 } // 5 second timeout
//         );

//         console.log(`🔗 URL shortened: ${url} → ${response.data.shortUrl || response.data.shortened_url}`);

//         // Return the shortened URL or the original if shortening failed
//         return response.data.shortened_url;
//     } catch (error) {
//         console.error("❌ Error shortening URL:", error.message);
//         // Return original URL if shortening fails
//         return url;
//     }
// };

// // Function to send task reminder to webhook - SIMPLIFIED
// const sendTaskToWebhook = async (task) => {
//   try {
//     const payload = {
//       id: task.id,
//       task_name: task.task_name,
//       task_file: task.task_file,
//       notes: task.notes,
//       assigned_to: task.assigned_to,
//       assigned_by: task.assigned_by,
//       department: task.department,
//       priority: task.priority,
//       status: task.status,
//       due_date: task.due_date,
//       pdf_url: task.pdf_url,  // Simple link or whatever URL was set
//       schema_name: task.schema_name || 'danger',
//       table_name: task.table_name || 'tasks',
//       message: `Reminder: Task "${task.task_name}" is due today`
//     };

//     // Use webhook from task record or fall back to default
//     const webhookUrl = task.webhook_task || "https://webhooks.wa.expert/webhook/682034da1f9f7b05384582b3";
    
//     console.log(`Using webhook URL: ${webhookUrl} for task ${task.task_name}`);

//     // Set timeout on request to prevent hanging
//     const response = await axios.post(webhookUrl, payload, {
//       headers: {
//         "Content-Type": "application/json"
//       },
//       timeout: 5000 // 5 second timeout
//     });

//     console.log(`✅ Sent to webhook: ${task.task_name} | Time (IST): ${moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss")}`);
//     return true;
//   } catch (error) {
//     console.error("❌ Error sending to webhook:", error.message);
//     if (error.response) {
//       console.error("Response status:", error.response.status);
//       console.error("Response data:", JSON.stringify(error.response.data));
//     }
//     throw error;
//   }
// };

// // Function to consume tasks from RabbitMQ queue - SIMPLIFIED
// const consumeTasks = async () => {
//   try {
//     // Set up consumer with manual acknowledgment
//     channel.consume(QUEUE_NAME, async (msg) => {
//       if (!msg) return;
      
//       let task;
      
//       try {
//         // Parse the message
//         task = JSON.parse(msg.content.toString());
//         console.log(`🔔 Processing task: ${task.task_name}`);

//         try {
//           // Try to generate a PDF URL
//           const pdfUrl = await generatePdfForTask(task);
//           task.pdf_url = pdfUrl;
//         } catch (pdfError) {
//           console.error("❌ Error generating PDF, using fallback URL:", pdfError.message);
//           task.pdf_url = `https://click.wa.expert/view-tasks?assigned_to=${encodeURIComponent(task.assigned_to)}`;
//         }
        
//         // Send the webhook
//         await sendTaskToWebhook(task);
        
//         // Acknowledge the message
//         channel.ack(msg);
//         console.log(`✅ Task processed and acknowledged: ${task.task_name}`);
//       } catch (error) {
//         console.error("❌ Error processing task:", error.message);
        
//         // Avoid requeuing tasks that have data parsing issues
//         if (!task) {
//           console.log("❌ Message parsing failed, not requeuing");
//           channel.ack(msg);
//         } else {
//           // For other errors, nack with requeue
//           channel.nack(msg, false, true);
//         }
//       }
//     }, { noAck: false }); // Manual acknowledgment

//     console.log("🎧 Task consumer started");
//   } catch (error) {
//     console.error("❌ Error setting up task consumer:", error);
//   }
// };

// // Create URL shortening table if it doesn't exist
// const initDatabase = async () => {
//     try {
//         await pool.query(`
//             CREATE TABLE IF NOT EXISTS shortened_urls (
//                 id SERIAL PRIMARY KEY,
//                 original_url TEXT NOT NULL,
//                 short_code VARCHAR(10) NOT NULL UNIQUE,
//                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//             );
//         `);
//         console.log('URL shortening database initialized successfully');
//     } catch (error) {
//         console.error('Error initializing URL shortening database:', error);
//     }
// };

// // Schedule task processing at 10:00 AM IST daily
// // Format: minute hour day-of-month month day-of-week
// cron.schedule("0 10 * * *", loadAllTasksDueToday, {
//     timezone: "Asia/Kolkata"
// });

// // Routing
// app.use('/users', userRoutes);
// app.use('/data', dataRoutes);
// app.use('/secure', userPermissionRoutes);
// app.use('/mfa', mfaRoutes);
// app.use('/webhooks',webhookRoutes);

// app.get('/', (req, res) => {
//     res.send("API is working");
// });

// // PDF Generation endpoint - SIMPLIFIED
// app.get("/generatePdf", async (req, res) => {
//   try {
//     const { schemaName, tableName, assignedTo } = req.query;
    
//     // Validate required parameters
//     if (!schemaName || !tableName || !assignedTo) {
//       return res.status(400).json({ 
//         error: "Missing required parameters", 
//         message: "schemaName, tableName, and assignedTo are required" 
//       });
//     }
    
//     console.log(`Generating PDF for ${assignedTo} from ${schemaName}.${tableName}`);
    
//     // Sanitize inputs to prevent SQL injection
//     const sanitizedQuery = `
//       SELECT * FROM "${schemaName}"."${tableName}" WHERE assigned_to = $1;  
//     `;
    
//     const result = await pool.query(sanitizedQuery, [assignedTo]);
    
//     // Check if we have tasks
//     if (!result.rows || result.rows.length === 0) {
//       return res.status(404).json({ 
//         error: "No tasks found", 
//         message: `No tasks found for ${assignedTo} in ${schemaName}.${tableName}` 
//       });
//     }
    
//     console.log(`Found ${result.rows.length} tasks for ${assignedTo}, generating PDF...`);
    
//     // Use a simplified version that just returns the URL
//     const pdfUrl = await generateSimplePdf(result.rows);
    
//     // Return the URL in the response
//     return res.json({ downloadUrl: pdfUrl });
    
//   } catch (error) {
//     console.error("❌ Error generating PDF:", error);
//     return res.status(500).json({ 
//       error: "Error generating PDF", 
//       message: error.message 
//     });
//   }
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

// // URL shortening endpoint for raw long content
// app.post('/shorten-raw', express.text({ type: '*/*', limit: '50mb' }), async (req, res) => {
//     try {
//         const originalUrl = req.body;

//         if (!originalUrl) {
//             return res.status(400).json({ error: 'URL in request body is required' });
//         }

//         // Generate a short code (8 characters)
//         const shortCode = nanoid(8);

//         // Store in database
//         await pool.query(
//             'INSERT INTO shortened_urls (original_url, short_code) VALUES ($1, $2)',
//             [originalUrl, shortCode]
//         );

//         // Construct the shortened URL
//         const baseUrl = `${req.protocol}://${req.get('host')}`;
//         const shortenedUrl = `${baseUrl}/${shortCode}`;

//         res.json({
//             original_url: originalUrl,
//             shortened_url: shortenedUrl,
//             short_code: shortCode
//         });
//     } catch (error) {
//         console.error('Error shortening URL:', error);
//         res.status(500).json({ error: 'Server error', details: error.message });
//     }
// });

// // URL shortening GET endpoint
// app.get('/sh', async (req, res) => {
//     console.log('Shorten endpoint accessed');

//     try {
//         // Get the raw URL from the query string - this preserves special characters
//         const fullUrl = req.url;
//         const urlParamIndex = fullUrl.indexOf('url=');

//         if (urlParamIndex === -1) {
//             console.log('No URL parameter provided');
//             return res.status(400).json({ error: 'URL parameter is required' });
//         }

//         // Extract everything after 'url='
//         const originalUrl = decodeURIComponent(fullUrl.slice(urlParamIndex + 4));
//         console.log('Decoded URL:', originalUrl);

//         // Basic validation - ensure it has a protocol
//         if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
//             console.log('Invalid URL format - missing protocol');
//             return res.status(400).json({ error: 'Invalid URL format - URL must start with http:// or https://' });
//         }

//         // Generate a short code (8 characters)
//         const shortCode = nanoid(8);
//         console.log('Generated short code:', shortCode);

//         // Store in database
//         await pool.query(
//             'INSERT INTO shortened_urls (original_url, short_code) VALUES ($1, $2)',
//             [originalUrl, shortCode]
//         );
//         console.log('URL stored in database');

//         // Construct the shortened URL
//         const baseUrl = `${req.protocol}://${req.get('host')}`;
//         const shortenedUrl = `${baseUrl}/api/${shortCode}`;
//         console.log('Shortened URL:', shortenedUrl);

//         res.json({
//             original_url: originalUrl,
//             shortened_url: shortenedUrl,
//             short_code: shortCode
//         });

//     } catch (error) {
//         console.error('Error shortening URL:', error);
//         res.status(500).json({ error: 'Server error', details: error.message });
//     }
// });

// // URL redirection endpoint
// app.get('/:shortCode', async (req, res) => {
//     try {
//         const { shortCode } = req.params;
//         console.log('Redirect requested for short code:', shortCode);

//         // Look up the original URL in the database
//         const result = await pool.query(
//             'SELECT original_url FROM shortened_urls WHERE short_code = $1',
//             [shortCode]
//         );

//         if (result.rows.length === 0) {
//             console.log('Short URL not found:', shortCode);
//             return res.status(404).json({ error: 'Short URL not found' });
//         }

//         const originalUrl = result.rows[0].original_url;
//         console.log('Redirecting to:', originalUrl);

//         // Redirect to the original URL
//         res.redirect(originalUrl);

//     } catch (error) {
//         console.error('Error redirecting:', error);
//         res.status(500).json({ error: 'Server error' });
//     }
// });

// // Task processing endpoints
// app.post("/process-tasks", async (req, res) => {
//     try {
//         const { all_schemas = true } = req.body;

//         if (all_schemas) {
//             const tasksQueued = await loadAllTasksDueToday();
//             res.status(200).json({
//                 message: "Task processing triggered successfully for all schemas",
//                 tasksQueued,
//                 timestamp: moment().tz("Asia/Kolkata").format()
//             });
//         } else {
//             await loadTasksDueToday();
//             res.status(200).json({
//                 message: "Task processing triggered successfully for default schema",
//                 timestamp: moment().tz("Asia/Kolkata").format()
//             });
//         }
//     } catch (error) {
//         console.error("❌ Error triggering task processing:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.toString() });
//     }
// });

// // Task table discovery endpoint
// app.get("/discover-task-tables", async (req, res) => {
//     try {
//         const tables = await discoverTaskTables();
//         res.status(200).json({
//             message: "Task tables discovered successfully",
//             tables,
//             count: tables.length
//         });
//     } catch (error) {
//         console.error("❌ Error discovering task tables:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.toString() });
//     }
// });

// // Task creation endpoint
// app.post("/tasks/create", async (req, res) => {
//     try {
//         const {
//             task_name,
//             task_file,
//             notes,
//             assigned_to,
//             assigned_by,
//             department,
//             priority,
//             status,
//             due_date,
//             us_id,
//             webhook_task,  // Added explicit webhook_task field handling
//             schema_name = 'danger' // Default schema if not specified
//         } = req.body;

//         if (!task_name || !assigned_to || !assigned_by || !due_date) {
//             return res.status(400).json({ error: "Required fields are missing" });
//         }

//         // Generate a UUID for the task
//         const id = uuidv4();

//         // Set current date/time in IST
//         const created_at = moment().tz("Asia/Kolkata").format();

//         // Insert into database (now with configurable schema and webhook_task field)
//         const result = await pool.query(
//             `INSERT INTO "${schema_name}".tasks (
//                 id, task_name, task_file, notes, assigned_to, assigned_by, 
//                 department, priority, status, due_date, us_id, created_at, processed, webhook_task
//             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
//             [
//                 id, task_name, task_file, notes, assigned_to, assigned_by,
//                 department, priority, status, due_date, us_id, created_at, false, webhook_task
//             ]
//         );

//         res.status(201).json({
//             message: "Task created successfully",
//             task: result.rows[0],
//             schema: schema_name
//         });
//     } catch (error) {
//         console.error("❌ Error creating task:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.toString() });
//     }
// });

// // URL shortener simple frontend
// app.get('/front/shorten', (req, res) => {
//     res.send(`
//     <html>
//     <head>
//       <title>URL Shortener</title>
//       <style>
//         body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
//         h1, h2 { color: #333; }
//         .form-group { margin-bottom: 15px; }
//         input[type="text"] { width: 80%; padding: 8px; font-size: 16px; }
//         button { padding: 8px 16px; background-color: #4CAF50; color: white; border: none; cursor: pointer; }
//         #result { margin-top: 20px; padding: 10px; border: 1px solid #ddd; display: none; }
//         pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
//       </style>
//     </head>
//     <body>
//       <h1>URL Shortener</h1>
      
//       <h2>Method 1: Web Interface</h2>
//       <div class="form-group">
//         <input type="text" id="url-input" placeholder="Enter a URL to shorten" />
//         <button onclick="shortenUrl()">Shorten</button>
//       </div>
//       <div id="result"></div>
           
//       <script>
//         async function shortenUrl() {
//           const url = document.getElementById('url-input').value;
//           if (!url) {
//             alert('Please enter a URL');
//             return;
//           }
          
//           try {
//             // For complex URLs, use the raw endpoint
//             if (url.includes('?') && url.length > 500) {
//               const response = await fetch('/api/shorten-raw', {
//                 method: 'POST',
//                 headers: {
//                   'Content-Type': 'text/plain'
//                 },
//                 body: url
//               });
//               const data = await response.json();
//   if (response.ok) {
//                 displayResult(data);
//               } else {
//                 alert(data.error || 'Error shortening URL');
//               }
//             } else {
//               // For simpler URLs, use the GET endpoint
//               const response = await fetch('/api/sh?url=' + encodeURIComponent(url));
//               const data = await response.json();
              
//               if (response.ok) {
//                 displayResult(data);
//               } else {
//                 alert(data.error || 'Error shortening URL');
//               }
//             }
//           } catch (error) {
//             alert('Error connecting to server');
//           }
//         }
        
//         function displayResult(data) {
//           const resultDiv = document.getElementById('result');
//           resultDiv.style.display = 'block';
//           resultDiv.innerHTML = \`
//             <p>Original URL: \${data.original_url}</p>
//             <p>Shortened URL: <a href="\${data.shortened_url}" target="_blank">\${data.shortened_url}</a></p>
//           \`;
//         }
//       </script>
//     </body>
//     </html>
//   `);
// });

// // Direct PDF download link
// app.get("/download-pdf", async (req, res) => {
//   try {
//     const { url } = req.query;
    
//     if (!url) {
//       return res.status(400).send("URL parameter is required");
//     }
    
//     console.log(`Downloading PDF from URL: ${url}`);
    
//     // Fetch the PDF
//     const response = await axios({
//       method: 'GET',
//       url: url,
//       responseType: 'stream',
//       timeout: 10000 // 10 second timeout
//     });
    
//     // Set headers to force download
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', 'attachment; filename="tasks.pdf"');
    
//     // Pipe the PDF to the response
//     response.data.pipe(res);
//   } catch (error) {
//     console.error("Error serving PDF:", error.message);
//     if (!res.headersSent) {
//       res.status(500).send("Error downloading PDF");
//     }
//   }
// });

// // Health check endpoint
// app.get("/health", (req, res) => {
//   res.status(200).json({
//     status: "UP",
//     timestamp: new Date().toISOString(),
//     rabbitmq: channel ? "CONNECTED" : "DISCONNECTED"
//   });
// });

// // Initialize server with more resilient startup

// // Improved startup sequence
// const startServer = async () => {
//     try {
//         // Initialize URL shortening database
//         await initDatabase();
        
//         // Start the server first
//         const server = app.listen(PORT, () => {
//             console.log(`Server running at http://localhost:${PORT}`, new Date());
//             console.log("📅 Task reminder system started...");
//         });
        
//         // Connect to RabbitMQ first before processing tasks
//         try {
//             console.log("Connecting to RabbitMQ...");
            
//             // Connect to RabbitMQ and wait for connection to establish
//             await connectRabbitMQ();
            
//             // Now that RabbitMQ is connected, check if we need to run task processor
//             const now = moment().tz("Asia/Kolkata");
//             if (now.hour() >= 10) {
//                 console.log("Starting initial task check across all schemas...");
//                 await loadAllTasksDueToday();
//             } else {
//                 console.log(`Waiting until 10:00 AM IST for scheduled task processing (current time: ${now.format("HH:mm")})`);
//             }
//         } catch (error) {
//             console.error("❌ RabbitMQ connection failed:", error.message);
//             console.log("Server continues to run without RabbitMQ. Will retry connection periodically.");
//         }
//     } catch (error) {
//         console.error("❌ Failed to initialize server:", error);
//         process.exit(1);
//     }
// };

// //Add global error handler to prevent crashes
// process.on('unhandledRejection', (reason, promise) => {
//     console.error('Unhandled Rejection at:', promise, 'reason:', reason);
//     // Don't exit the process, let it continue running
// });

// // Start the server
// startServer();




const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class TaskReportGenerator {
    constructor() {
        this.doc = null;
        this.currentY = 0;
        this.pageMargin = 50;
        this.pageWidth = 612 - (2 * this.pageMargin);
        
        // Priority colors - matching the PDF style
        this.priorityColors = {
            'High': '#FFE4E1',      // Light Pink/Red
            'Medium': '#E6F3FF',    // Light Blue
            'Low': '#F0FFF0'        // Light Green
        };
        
        // Updated table configuration to match the PDF
        this.tableConfig = {
            columns: [
                { name: 'Task Name', width: 100 },
                { name: 'Description', width: 120 },
                { name: 'Remarks', width: 100 },
                { name: 'Attachments', width: 80 },
                { name: 'Due Date', width: 70 },
                { name: 'Mark Done', width: 70 }
            ],
            rowHeight: 35,
            headerHeight: 25,
            fontSize: 9,
            headerFontSize: 10
        };
    }

    /**
     * Generate PDF report matching the provided format
     */
    generateReport(employeeData, outputPath) {
        // Create new PDF document
        this.doc = new PDFDocument({ 
            margin: this.pageMargin,
            size: 'letter'
        });
        
        // Pipe to file
        this.doc.pipe(fs.createWriteStream(outputPath));
        
        // Add header
        this.addHeader();
        
        // Add greeting and summary
        this.addGreeting(employeeData.email || employeeData.name, employeeData.date);
        
        // Categorize tasks
        const categorizedTasks = this.categorizeTasks(employeeData.tasks);
        
        // Add sections
        if (categorizedTasks.overdue.length > 0) {
            this.addSection('OVERDUE', categorizedTasks.overdue, employeeData.email || employeeData.name);
        }
        
        if (categorizedTasks.dueToday.length > 0) {
            this.addSection('DUE TODAY', categorizedTasks.dueToday, employeeData.email || employeeData.name);
        }
        
        if (categorizedTasks.dueLater.length > 0) {
            this.addSection('DUE LATER', categorizedTasks.dueLater, employeeData.email || employeeData.name);
        }
        
        // Finalize PDF
        this.doc.end();
        
        console.log(`PDF generated: ${outputPath}`);
    }

    /**
     * Add company header
     */
    addHeader() {
        this.doc
            .fontSize(16)
            .font('Helvetica-Bold')
            .text('Company Name', {
                align: 'center'
            });
        
        this.doc.moveDown(1);
        this.currentY = this.doc.y;
    }

    /**
     * Add greeting section
     */
    addGreeting(email, currentDate) {
        this.doc
            .fontSize(11)
            .font('Helvetica')
            .text(`Dear ${email},`, {
                align: 'left'
            });
        
        this.doc.moveDown(0.5);
        
        this.doc
            .fontSize(10)
            .text(`This document provides a summary of your tasks as of ${currentDate}, organized by due date and priority. Please review your tasks and their status to manage your workload effectively. You can click on "Click Here" to mark tasks as complete.`, {
                align: 'left',
                width: this.pageWidth
            });
        
        this.doc.moveDown(1.5);
        this.currentY = this.doc.y;
    }

    /**
     * Categorize tasks by due date
     */
    categorizeTasks(tasks) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const categorized = {
            overdue: [],
            dueToday: [],
            dueLater: []
        };
        
        tasks.forEach(task => {
            if (task.status && task.status.toLowerCase() === 'completed') {
                return; // Skip completed tasks
            }
            
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            
            if (dueDate < today) {
                categorized.overdue.push(task);
            } else if (dueDate.getTime() === today.getTime()) {
                categorized.dueToday.push(task);
            } else {
                categorized.dueLater.push(task);
            }
        });
        
        // Sort each category by priority
        const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
        
        Object.keys(categorized).forEach(key => {
            categorized[key].sort((a, b) => {
                const priorityA = priorityOrder[a.priority] || 4;
                const priorityB = priorityOrder[b.priority] || 4;
                return priorityA - priorityB;
            });
        });
        
        return categorized;
    }

    /**
     * Add a section (OVERDUE, DUE TODAY, DUE LATER)
     */
    addSection(sectionTitle, tasks, email) {
        if (tasks.length === 0) return;
        
        // Section header
        this.doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#000080') // Dark blue for section titles
            .text(sectionTitle, this.pageMargin, this.currentY);
        
        this.doc.moveDown(0.5);
        this.currentY = this.doc.y;
        
        // Tasks for: email
        this.doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('black')
            .text(`Tasks for: ${email}`, this.pageMargin, this.currentY);
        
        this.doc.moveDown(1);
        this.currentY = this.doc.y;
        
        // Group tasks by priority
        const tasksByPriority = this.groupByPriority(tasks);
        
        // Add tables for each priority
        ['High', 'Medium', 'Low'].forEach(priority => {
            if (tasksByPriority[priority] && tasksByPriority[priority].length > 0) {
                this.addPrioritySection(priority, tasksByPriority[priority]);
            }
        });
    }

    /**
     * Group tasks by priority
     */
    groupByPriority(tasks) {
        const grouped = {};
        
        tasks.forEach(task => {
            const priority = task.priority || 'Low';
            if (!grouped[priority]) {
                grouped[priority] = [];
            }
            grouped[priority].push(task);
        });
        
        return grouped;
    }

    /**
     * Add priority section with table
     */
    addPrioritySection(priority, tasks) {
        // Check if we need a new page
        const estimatedHeight = 30 + (tasks.length * this.tableConfig.rowHeight);
        if (this.currentY + estimatedHeight > 700) {
            this.doc.addPage();
            this.currentY = this.pageMargin;
        }
        
        // Priority heading
        this.doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .fillColor('#333333')
            .text(`${priority} Priority`, this.pageMargin, this.currentY);
        
        this.currentY += 20;
        
        // Draw table
        this.drawTable(priority, tasks);
        
        // Add spacing after table
        this.currentY += 20;
    }

    /**
     * Draw table for tasks
     */
    drawTable(priority, tasks) {
        const headerColor = this.priorityColors[priority];
        const startX = this.pageMargin;
        
        // Draw header
        this.drawTableHeader(headerColor, startX);
        
        // Draw rows
        tasks.forEach((task, index) => {
            this.drawTableRow(task, index, startX);
        });
    }

    /**
     * Draw table header
     */
    drawTableHeader(color, startX) {
        let currentX = startX;
        
        // Header background
        this.doc
            .rect(startX, this.currentY, this.pageWidth, this.tableConfig.headerHeight)
            .fill(color)
            .stroke('#CCCCCC');
        
        // Header text
        this.doc
            .fillColor('black')
            .fontSize(this.tableConfig.headerFontSize)
            .font('Helvetica-Bold');
        
        this.tableConfig.columns.forEach(column => {
            this.doc.text(
                column.name,
                currentX + 3,
                this.currentY + 5,
                {
                    width: column.width - 6,
                    align: 'left'
                }
            );
            currentX += column.width;
        });
        
        this.currentY += this.tableConfig.headerHeight;
    }

    /**
     * Draw table row
     */
    drawTableRow(task, index, startX) {
        let currentX = startX;
        const rowY = this.currentY;
        
        // Check if we need a new page
        if (this.currentY + this.tableConfig.rowHeight > 700) {
            this.doc.addPage();
            this.currentY = this.pageMargin;
        }
        
        // Row border
        this.doc
            .rect(startX, this.currentY, this.pageWidth, this.tableConfig.rowHeight)
            .stroke('#CCCCCC');
        
        // Reset text settings
        this.doc
            .fillColor('black')
            .fontSize(this.tableConfig.fontSize)
            .font('Helvetica');
        
        // Task Name
        this.drawCellText(task.taskName || '', currentX, this.currentY, this.tableConfig.columns[0].width);
        currentX += this.tableConfig.columns[0].width;
        
        // Description
        this.drawCellText(task.description || 'Please prioritize this task.', currentX, this.currentY, this.tableConfig.columns[1].width);
        currentX += this.tableConfig.columns[1].width;
        
        // Remarks
        this.drawCellText(task.remarks || 'Waiting for approval', currentX, this.currentY, this.tableConfig.columns[2].width);
        currentX += this.tableConfig.columns[2].width;
        
        // Attachments
        if (task.attachmentUrl) {
            this.doc
                .fillColor('#0066CC')
                .font('Helvetica')
                .text('View File', currentX + 3, this.currentY + 10, {
                    width: this.tableConfig.columns[3].width - 6,
                    align: 'center',
                    link: task.attachmentUrl
                });
        }
        currentX += this.tableConfig.columns[3].width;
        
        // Due Date
        this.doc
            .fillColor('black')
            .font('Helvetica');
        this.drawCellText(this.formatShortDate(task.dueDate), currentX, this.currentY, this.tableConfig.columns[4].width);
        currentX += this.tableConfig.columns[4].width;
        
        // Mark Done (Click Here link)
        const actionUrl = task.webhookUrl || `https://example.com/complete?uid=${task.uid}`;
        this.doc
            .fillColor('#0066CC')
            .font('Helvetica')
            .text('Click Here', currentX + 3, this.currentY + 10, {
                width: this.tableConfig.columns[5].width - 6,
                align: 'center',
                link: actionUrl,
                underline: true
            });
        
        this.currentY += this.tableConfig.rowHeight;
    }

    /**
     * Draw text in table cell
     */
    drawCellText(text, x, y, width) {
        const textY = y + 10; // Vertical padding
        
        this.doc.text(text, x + 3, textY, {
            width: width - 6,
            align: 'left',
            ellipsis: true,
            lineBreak: false
        });
    }

    /**
     * Format date to short format (e.g., "Mon May 05")
     */
    formatShortDate(date) {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return date.toString();
        
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        return `${days[d.getDay()]} ${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
    }
}

// Example usage
async function generateEmployeeReport() {
    const generator = new TaskReportGenerator();
    
    // Sample data matching the PDF format
    const employeeData = {
        name: 'John Doe',
        email: 'jh@example.com',
        date: '05/11/2025',
        tasks: [
            // Overdue High Priority
            {
                taskName: 'Review Report 3',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-05',
                status: 'Pending',
                priority: 'High',
                uid: 'W0001',
                attachmentUrl: 'https://example.com/files/report3.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0001'
            },
            {
                taskName: 'Review Report 11',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-07',
                status: 'Pending',
                priority: 'High',
                uid: 'W0002',
                attachmentUrl: 'https://example.com/files/report11.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0002'
            },
            // Overdue Low Priority
            {
                taskName: 'Review Report 4',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-06',
                status: 'Pending',
                priority: 'Low',
                uid: 'W0003',
                attachmentUrl: 'https://example.com/files/report4.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0003'
            },
            {
                taskName: 'Review Report 5',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-07',
                status: 'Pending',
                priority: 'Low',
                uid: 'W0004',
                attachmentUrl: 'https://example.com/files/report5.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0004'
            },
            {
                taskName: 'Review Report 6',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-08',
                status: 'Pending',
                priority: 'Low',
                uid: 'W0005',
                attachmentUrl: 'https://example.com/files/report6.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0005'
            },
            {
                taskName: 'Review Report 7',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-09',
                status: 'Pending',
                priority: 'Low',
                uid: 'W0006',
                attachmentUrl: 'https://example.com/files/report7.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0006'
            },
            {
                taskName: 'Review Report 8',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-10',
                status: 'Pending',
                priority: 'Low',
                uid: 'W0007',
                attachmentUrl: 'https://example.com/files/report8.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0007'
            },
            // Due Today Low Priority
            {
                taskName: 'Review Report 9',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-11',
                status: 'Pending',
                priority: 'Low',
                uid: 'W0008',
                attachmentUrl: 'https://example.com/files/report9.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0008'
            },
            {
                taskName: 'Review Report 10',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-11',
                status: 'Pending',
                priority: 'Low',
                uid: 'W0009',
                attachmentUrl: 'https://example.com/files/report10.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0009'
            },
            // Due Later High Priority
            {
                taskName: 'Review Report 5',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-15',
                status: 'Pending',
                priority: 'High',
                uid: 'W0010',
                attachmentUrl: 'https://example.com/files/report5.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0010'
            },
            {
                taskName: 'Review Report 10',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-15',
                status: 'Pending',
                priority: 'High',
                uid: 'W0011',
                attachmentUrl: 'https://example.com/files/report10.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0011'
            },
            // Due Later Medium Priority
            {
                taskName: 'Review Report 7',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-15',
                status: 'Pending',
                priority: 'Medium',
                uid: 'W0012',
                attachmentUrl: 'https://example.com/files/report7.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0012'
            },
            // Due Later Low Priority
            {
                taskName: 'Review Report 9',
                description: 'Please prioritize this task.',
                remarks: 'Waiting for approval',
                dueDate: '2025-05-15',
                status: 'Pending',
                priority: 'Low',
                uid: 'W0013',
                attachmentUrl: 'https://example.com/files/report9.pdf',
                webhookUrl: 'https://example.com/complete?uid=W0013'
            }
        ]
    };
    
    // For testing with today's date, uncomment these lines:
    // const today = new Date();
    // employeeData.date = today.toLocaleDateString('en-US');
    // // Adjust some task dates to be overdue, due today, and due later
    // employeeData.tasks[0].dueDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000); // 6 days ago
    // employeeData.tasks[7].dueDate = today; // Today
    // employeeData.tasks[9].dueDate = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days later
    
    // Generate PDF
    const outputPath = path.join(__dirname, `${employeeData.email.replace('@', '-')}-tasks-${employeeData.date.replace(/\//g, '-')}.pdf`);
    generator.generateReport(employeeData, outputPath);
}

// Export for use in other modules
module.exports = TaskReportGenerator;

// Run example if called directly
if (require.main === module) {
    generateEmployeeReport().catch(console.error);
}