
// const amqp = require('amqplib');
// require("dotenv").config();
// const express = require("express");
// const cron = require("node-cron");
// const axios = require("axios");
// const moment = require("moment-timezone");

// // Safe database import
// let pool;
// try {
//     pool = require('../database/databaseConnection');
// } catch (error) {
//     console.error('❌ [Reminder] Failed to import database connection:', error.message);
// }

// const router = express.Router();

// // REMOVED: Body parser middleware (handled at app level)
// // REMOVED: API call counter (handled at app level)

// // RabbitMQ connection variables
// let rabbitConnection = null;
// let rabbitChannel = null;
// let isShuttingDown = false;

// const REMINDER_QUEUE = 'reminder_notifications';
// const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://webhooks.wa.expert/webhook/686cd5afe3591ae351cc2970";

// // Initialize RabbitMQ connection with retry logic
// const initRabbitMQ = async (retries = 5, delay = 2000) => {
//     for (let i = 0; i < retries; i++) {
//         try {
//             console.log(`🔄 [Reminder] Attempting RabbitMQ connection (attempt ${i + 1}/${retries})...`);

//             rabbitConnection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
//             rabbitChannel = await rabbitConnection.createChannel();

//             // Add connection error handlers
//             rabbitConnection.on('error', (err) => {
//                 if (!isShuttingDown) {
//                     console.error('❌ [Reminder] RabbitMQ connection error:', err.message);
//                 }
//             });

//             rabbitConnection.on('close', () => {
//                 if (!isShuttingDown) {
//                     console.log('⚠️ [Reminder] RabbitMQ connection closed, attempting to reconnect...');
//                     setTimeout(() => initRabbitMQ(), 5000);
//                 }
//             });

//             // Declare the reminder queue
//             await rabbitChannel.assertQueue(REMINDER_QUEUE, { durable: true });

//             console.log("✅ [Reminder] RabbitMQ connected and queue declared");

//             // Start consuming messages from the queue
//             consumeReminderQueue();
//             return; 

//         } catch (error) {
//             console.log(`❌ [Reminder] Connection attempt ${i + 1} failed:`, error.message);

//             if (i === retries - 1) {
//                 console.error("❌ [Reminder] Failed to connect to RabbitMQ after all retries");
//                 throw error;
//             }

//             console.log(`⏳ [Reminder] Waiting ${delay}ms before retry...`);
//             await new Promise(resolve => setTimeout(resolve, delay));
//         }
//     }
// };

// // FIX: Improved time-based reminder fetching to prevent duplicates
// const getDueReminders = async () => {
//     try {
//         if (!pool) {
//             throw new Error('Database connection not available');
//         }

//         // FIX: Create separate moment objects to avoid mutation
//         const now = moment().tz(process.env.TIMEZONE || 'UTC');
//         const currentTime = now.format('HH:mm');
//         const currentDate = now.format('YYYY-MM-DD');

//         // FIX: Create a new moment object for lastCheckTime
//         const fiveMinutesAgo = moment().tz(process.env.TIMEZONE || 'UTC').subtract(5, 'minutes');
//         const lastCheckTime = fiveMinutesAgo.format('HH:mm');

//         console.log(`⏰ [Reminder] Checking for reminders at: ${currentDate} ${currentTime}`);
//         console.log(`📊 [Reminder] Time window: ${lastCheckTime} < time <= ${currentTime}`);

//         // Better query to prevent duplicate processing
//         const query = `
//             SELECT 
//                 id,
//                 title,
//                 message,
//                 reminder_time,
//                 reminder_date,
//                 recipient_name,
//                 recipient_phone,
//                 sender_name,
//                 sender_phone,
//                 reminder_type,
//                 status
//             FROM reminders 
//             WHERE reminder_date = $1 
//             AND reminder_time > $2
//             AND reminder_time <= $3
//             AND status = 'pending'
//             ORDER BY reminder_time ASC
//         `;

//         const { rows } = await pool.query(query, [currentDate, lastCheckTime, currentTime]);

//         console.log(`📝 [Reminder] Found ${rows.length} due reminders`);
//         return rows;

//     } catch (error) {
//         console.error("❌ [Reminder] Error fetching due reminders:", error.message);
//         return [];
//     }
// };

// // Function to send reminder data to RabbitMQ queue
// const sendReminderToQueue = async (reminderData) => {
//     try {
//         if (!rabbitChannel) {
//             console.error("❌ [Reminder] RabbitMQ channel not available");
//             return false;
//         }

//         const message = {
//             id: reminderData.id,
//             title: reminderData.title,
//             message: reminderData.message,
//             reminder_time: reminderData.reminder_time,
//             reminder_date: reminderData.reminder_date,
//             recipient_name: reminderData.recipient_name,
//             recipient_phone: reminderData.recipient_phone,
//             sender_name: reminderData.sender_name,
//             sender_phone: reminderData.sender_phone,
//             reminder_type: reminderData.reminder_type,
//             final_message: `⏰ Reminder: ${reminderData.title}\n\n${reminderData.message}\n\nFrom: ${reminderData.sender_name}`,
//             timestamp: new Date().toISOString()
//         };

//         await rabbitChannel.sendToQueue(
//             REMINDER_QUEUE, 
//             Buffer.from(JSON.stringify(message)),
//             { persistent: true }
//         );

//         console.log(`📤 [Reminder] Sent to queue: ${reminderData.title}`);
//         return true;

//     } catch (error) {
//         console.error("❌ [Reminder] Error sending to queue:", error.message);
//         return false;
//     }
// };

// // Improved queue consumer with error recovery
// const consumeReminderQueue = async () => {
//     try {
//         if (!rabbitChannel) {
//             console.error("❌ [Reminder] RabbitMQ channel not available for consuming");
//             return;
//         }

//         await rabbitChannel.consume(REMINDER_QUEUE, async (msg) => {
//             if (msg !== null) {
//                 try {
//                     const reminderData = JSON.parse(msg.content.toString());
//                     console.log(`📥 [Reminder] Processing from queue: ${reminderData.title}`);

//                     // Update status first to prevent race conditions
//                     await updateReminderStatus(reminderData.id, 'processing');

//                     // Send to webhook
//                     await sendReminderToWebhook(reminderData);

//                     // Update reminder status to 'sent'
//                     await updateReminderStatus(reminderData.id, 'sent');

//                     // Acknowledge the message
//                     rabbitChannel.ack(msg);

//                 } catch (error) {
//                     console.error("❌ [Reminder] Error processing message:", error.message);

//                     // Reset status on failure
//                     try {
//                         const reminderData = JSON.parse(msg.content.toString());
//                         await updateReminderStatus(reminderData.id, 'failed');
//                     } catch (parseError) {
//                         console.error("❌ [Reminder] Could not parse message for status update:", parseError.message);
//                     }

//                     // Reject and requeue the message
//                     rabbitChannel.nack(msg, false, true);
//                 }
//             }
//         });

//         console.log("🔄 [Reminder] Queue consumer started");

//     } catch (error) {
//         console.error("❌ [Reminder] Error setting up queue consumer:", error.message);

//         // Retry consumer setup after delay
//         if (!isShuttingDown) {
//             setTimeout(() => {
//                 console.log("🔄 [Reminder] Retrying consumer setup...");
//                 consumeReminderQueue();
//             }, 5000);
//         }
//     }
// };

// // Enhanced status update with better error handling
// const updateReminderStatus = async (reminderId, status) => {
//     try {
//         if (!pool) {
//             console.error('❌ [Reminder] Database connection not available for status update');
//             return false;
//         }

//         const result = await pool.query(
//             "UPDATE reminders SET status = $1, sent_at = $2 WHERE id = $3 RETURNING id",
//             [status, new Date(), reminderId]
//         );

//         if (result.rowCount === 0) {
//             console.warn(`⚠️ [Reminder] No reminder found with ID: ${reminderId}`);
//             return false;
//         }

//         console.log(`✅ [Reminder] Status updated to '${status}' for ID: ${reminderId}`);
//         return true;
//     } catch (error) {
//         console.error(`❌ [Reminder] Error updating status:`, error.message);
//         return false;
//     }
// };

// // Function to send reminder to webhook
// const sendReminderToWebhook = async (reminderData) => {
//     try {
//         const encodedMessage = encodeURIComponent(reminderData.final_message);
//         const whatsappLink = `https://wa.me/${reminderData.sender_phone}?text=${encodedMessage}`;

//         const payload = {
//             id: reminderData.id,
//             title: reminderData.title,
//             message: reminderData.message,
//             recipient_name: reminderData.recipient_name,
//             recipient_phone: reminderData.recipient_phone,
//             sender_name: reminderData.sender_name,
//             sender_phone: reminderData.sender_phone,
//             reminder_type: reminderData.reminder_type,
//             reminder_time: reminderData.reminder_time,
//             reminder_date: reminderData.reminder_date,
//             final_message: reminderData.final_message,
//             whatsapp_link: whatsappLink,
//             timestamp: reminderData.timestamp
//         };

//         const response = await axios.post(WEBHOOK_URL, payload, {
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             timeout: 10000
//         });

//         console.log(`✅ [Reminder] Sent to webhook: ${reminderData.title}`);
//         console.log(`🔗 [Reminder] Webhook Response Status: ${response.status}`);

//     } catch (error) {
//         console.error(`❌ [Reminder] Error sending webhook for ${reminderData.title}:`, 
//             error.response ? error.response.data : error.message);
//         throw error; // Re-throw to handle in queue consumer
//     }
// };

// // Enhanced reminder processing with better error handling
// const processDueReminders = async () => {
//     try {
//         console.log("⏰ [Reminder] Starting processing...");

//         const reminders = await getDueReminders();

//         if (reminders.length === 0) {
//             console.log("😔 [Reminder] No due reminders found");
//             return;
//         }

//         let successCount = 0;
//         let errorCount = 0;

//         // Send each reminder to the queue
//         for (const reminder of reminders) {
//             try {
//                 const success = await sendReminderToQueue(reminder);
//                 if (success) {
//                     successCount++;
//                 } else {
//                     errorCount++;
//                 }
//             } catch (error) {
//                 console.error(`❌ [Reminder] Error processing reminder ${reminder.id}:`, error.message);
//                 errorCount++;
//             }

//             // Small delay to prevent overwhelming the queue
//             await new Promise(resolve => setTimeout(resolve, 100));
//         }

//         console.log(`⏰ [Reminder] Processing completed: ${successCount} sent, ${errorCount} failed`);

//     } catch (error) {
//         console.error("❌ [Reminder] Error processing reminders:", error.message);
//     }
// };

// // Route: Manually trigger reminder processing
// router.post("/process", async (req, res) => {
//     try {
//         await processDueReminders();
//         res.status(200).json({ 
//             success: true,
//             message: "Reminder processing initiated successfully",
//             timestamp: new Date().toISOString()
//         });
//     } catch (error) {
//         console.error("[Reminder] Error in manual processing:", error.message);
//         res.status(500).json({ 
//             success: false,
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // Route: Add a new reminder
// router.post("/add", async (req, res) => {
//     try {
//         if (!pool) {
//             return res.status(503).json({ 
//                 success: false,
//                 error: "Database connection not available" 
//             });
//         }

//         const { 
//             title, 
//             message, 
//             reminder_time, 
//             reminder_date, 
//             recipient_name, 
//             recipient_phone, 
//             sender_name, 
//             sender_phone, 
//             reminder_type 
//         } = req.body;

//         // Validate required fields
//         const requiredFields = ['title', 'message', 'reminder_time', 'reminder_date', 'recipient_name', 'recipient_phone', 'sender_name', 'sender_phone'];
//         const missingFields = requiredFields.filter(field => !req.body[field]);

//         if (missingFields.length > 0) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: "Missing required fields",
//                 missing: missingFields
//             });
//         }

//         // Validate date format
//         if (!moment(reminder_date, 'YYYY-MM-DD', true).isValid()) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: "Invalid date format. Use YYYY-MM-DD" 
//             });
//         }

//         // Validate time format
//         if (!moment(reminder_time, 'HH:mm', true).isValid()) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: "Invalid time format. Use HH:mm (24-hour format)" 
//             });
//         }

//         await pool.query(
//             `INSERT INTO reminders 
//             (title, message, reminder_time, reminder_date, recipient_name, recipient_phone, sender_name, sender_phone, reminder_type, status, created_at) 
//             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
//             [title, message, reminder_time, reminder_date, recipient_name, recipient_phone, sender_name, sender_phone, reminder_type || 'general', 'pending', new Date()]
//         );

//         res.status(201).json({ 
//             success: true,
//             message: "Reminder added successfully" 
//         });
//     } catch (error) {
//         console.error("[Reminder] Error adding reminder:", error.message);
//         res.status(500).json({ 
//             success: false,
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // Route: Get all reminders
// router.get("/list", async (req, res) => {
//     try {
//         if (!pool) {
//             return res.status(503).json({ 
//                 success: false,
//                 error: "Database connection not available" 
//             });
//         }

//         const { rows } = await pool.query("SELECT * FROM reminders ORDER BY reminder_date, reminder_time");
//         res.status(200).json({
//             success: true,
//             data: rows,
//             count: rows.length
//         });
//     } catch (error) {
//         console.error("[Reminder] Error fetching reminders:", error.message);
//         res.status(500).json({ 
//             success: false,
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // Route: Get today's reminders
// router.get("/today", async (req, res) => {
//     try {
//         if (!pool) {
//             return res.status(503).json({ 
//                 success: false,
//                 error: "Database connection not available" 
//             });
//         }

//         const today = moment().format('YYYY-MM-DD');
//         const { rows } = await pool.query(
//             "SELECT * FROM reminders WHERE reminder_date = $1 ORDER BY reminder_time",
//             [today]
//         );
//         res.status(200).json({
//             success: true,
//             data: rows,
//             count: rows.length
//         });
//     } catch (error) {
//         console.error("[Reminder] Error fetching today's reminders:", error.message);
//         res.status(500).json({ 
//             success: false,
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // Route: Get pending reminders
// router.get("/pending", async (req, res) => {
//     try {
//         if (!pool) {
//             return res.status(503).json({ 
//                 success: false,
//                 error: "Database connection not available" 
//             });
//         }

//         const { rows } = await pool.query(
//             "SELECT * FROM reminders WHERE status = 'pending' ORDER BY reminder_date, reminder_time"
//         );
//         res.status(200).json({
//             success: true,
//             data: rows,
//             count: rows.length
//         });
//     } catch (error) {
//         console.error("[Reminder] Error fetching pending reminders:", error.message);
//         res.status(500).json({ 
//             success: false,
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // Route: Update reminder status
// router.patch("/:id/status", async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status } = req.body;

//         const validStatuses = ['pending', 'sent', 'cancelled', 'processing', 'failed'];
//         if (!validStatuses.includes(status)) {
//             return res.status(400).json({ 
//                 success: false,
//                 error: "Invalid status",
//                 validStatuses: validStatuses
//             });
//         }

//         const success = await updateReminderStatus(id, status);
//         if (success) {
//             res.status(200).json({ 
//                 success: true,
//                 message: "Reminder status updated successfully" 
//             });
//         } else {
//             res.status(404).json({ 
//                 success: false,
//                 error: "Reminder not found" 
//             });
//         }
//     } catch (error) {
//         console.error("[Reminder] Error updating reminder status:", error.message);
//         res.status(500).json({ 
//             success: false,
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // Route: Delete a reminder
// router.delete("/:id", async (req, res) => {
//     try {
//         if (!pool) {
//             return res.status(503).json({ 
//                 success: false,
//                 error: "Database connection not available" 
//             });
//         }

//         const { id } = req.params;
//         const result = await pool.query("DELETE FROM reminders WHERE id = $1 RETURNING id", [id]);

//         if (result.rowCount === 0) {
//             return res.status(404).json({ 
//                 success: false,
//                 error: "Reminder not found" 
//             });
//         }

//         res.status(200).json({ 
//             success: true,
//             message: "Reminder deleted successfully" 
//         });
//     } catch (error) {
//         console.error("[Reminder] Error deleting reminder:", error.message);
//         res.status(500).json({ 
//             success: false,
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // Route: Get queue status
// router.get("/queue/status", async (req, res) => {
//     try {
//         if (!rabbitChannel) {
//             return res.status(503).json({ 
//                 success: false,
//                 error: "RabbitMQ not connected" 
//             });
//         }

//         const queueInfo = await rabbitChannel.checkQueue(REMINDER_QUEUE);
//         res.status(200).json({
//             success: true,
//             queue: REMINDER_QUEUE,
//             messageCount: queueInfo.messageCount,
//             consumerCount: queueInfo.consumerCount
//         });
//     } catch (error) {
//         console.error("[Reminder] Error checking queue status:", error.message);
//         res.status(500).json({ 
//             success: false,
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // Graceful shutdown (internal function)
// const gracefulShutdown = async () => {
//     console.log("🛑 [Reminder] Shutting down gracefully...");
//     isShuttingDown = true;

//     try {
//         if (rabbitChannel) {
//             await rabbitChannel.close();
//             console.log("✅ [Reminder] RabbitMQ channel closed");
//         }
//         if (rabbitConnection) {
//             await rabbitConnection.close();
//             console.log("✅ [Reminder] RabbitMQ connection closed");
//         }

//         console.log("✅ [Reminder] System connections closed");
//     } catch (error) {
//         console.error("❌ [Reminder] Error during shutdown:", error.message);
//     }
// };

// // REMOVED: Global process event handlers (handled by main server)

// // Schedule reminder processing - runs every 5 minutes
// cron.schedule("*/5 * * * *", async () => {
//     try {
//         console.log("⏰ [Reminder] Scheduled processing started at", new Date().toLocaleString());
//         await processDueReminders();
//     } catch (error) {
//         console.error("❌ [Reminder] Error in scheduled processing:", error.message);
//     }
// });

// console.log("⏰ [Reminder] Notification system initializing...");

// // Initialize the reminder system
// const startReminderSystem = async () => {
//     try {
//         // Initialize RabbitMQ with retry logic
//         await initRabbitMQ();

//         console.log("📅 [Reminder] Notification system started successfully!");
//         console.log("⏰ [Reminder] Processing scheduled every 5 minutes");

//     } catch (error) {
//         console.error("❌ [Reminder] Failed to start system:", error.message);
//         throw error; // Let the main server handle this
//     }
// };

// // Export the router and functions
// module.exports = {
//     router,
//     startReminderSystem,
//     processDueReminders,
//     gracefulShutdown
// };

// // Auto-start if this file is run directly
// if (require.main === module) {
//     const express = require('express');
//     const app = express();

//     app.use(express.json());
//     app.use('/reminder', router);

//     startReminderSystem().then(() => {
//         app.listen(3001, () => {
//             console.log('🚀 [Reminder] System running on port 3001');
//         });
//     }).catch(error => {
//         console.error('[Reminder] Failed to start system:', error);
//         process.exit(1);
//     });
// }


const amqp = require('amqplib');
require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment-timezone");

// Safe database import
let pool;
try {
    pool = require('../database/databaseConnection');
} catch (error) {
    console.error('❌ [Reminder] Failed to import database connection:', error.message);
}

const router = express.Router();

// REMOVED: Body parser middleware (handled at app level)
// REMOVED: API call counter (handled at app level)

// RabbitMQ connection variables
let rabbitConnection = null;
let rabbitChannel = null;
let isShuttingDown = false;

const REMINDER_QUEUE = 'reminder_notifications';
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://webhooks.wa.expert/webhook/686d0a86e3591ae351cc6cce";

// Initialize RabbitMQ connection with retry logic
const initRabbitMQ = async (retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`🔄 [Reminder] Attempting RabbitMQ connection (attempt ${i + 1}/${retries})...`);

            rabbitConnection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
            rabbitChannel = await rabbitConnection.createChannel();

            // Add connection error handlers
            rabbitConnection.on('error', (err) => {
                if (!isShuttingDown) {
                    console.error('❌ [Reminder] RabbitMQ connection error:', err.message);
                }
            });

            rabbitConnection.on('close', () => {
                if (!isShuttingDown) {
                    console.log('⚠️ [Reminder] RabbitMQ connection closed, attempting to reconnect...');
                    setTimeout(() => initRabbitMQ(), 5000);
                }
            });

            // Declare the reminder queue
            await rabbitChannel.assertQueue(REMINDER_QUEUE, { durable: true });

            console.log("✅ [Reminder] RabbitMQ connected and queue declared");

            // Start consuming messages from the queue
            consumeReminderQueue();
            return;

        } catch (error) {
            console.log(`❌ [Reminder] Connection attempt ${i + 1} failed:`, error.message);

            if (i === retries - 1) {
                console.error("❌ [Reminder] Failed to connect to RabbitMQ after all retries");
                throw error;
            }

            console.log(`⏳ [Reminder] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// FIX: Improved time-based reminder fetching to prevent duplicates
const getDueReminders = async () => {
    try {
        if (!pool) {
            throw new Error('Database connection not available');
        }

        // Work in UTC since stored times are in UTC
        const now = moment().utc();
        const currentTime = now.format('HH:mm');
        const currentDate = now.format('YYYY-MM-DD');

        // Create a new moment object for lastCheckTime
        const fiveMinutesAgo = moment().utc().subtract(5, 'minutes');
        const lastCheckTime = fiveMinutesAgo.format('HH:mm');

        console.log(`⏰ [Reminder] Checking for reminders at: ${currentDate} ${currentTime} UTC`);
        console.log(`📊 [Reminder] Time window: ${lastCheckTime} < time <= ${currentTime}`);

        // Better query to prevent duplicate processing
        const query = `
            SELECT 
                id,
                title,
                message,
                reminder_time,
                reminder_date,
                recipient_name,
                recipient_phone,
                sender_name,
                sender_phone,
                reminder_type,
                status
            FROM reminders 
            WHERE reminder_date = $1 
            AND reminder_time > $2
            AND reminder_time <= $3
            AND status = 'pending'
            ORDER BY reminder_time ASC
        `;

        const { rows } = await pool.query(query, [currentDate, lastCheckTime, currentTime]);

        console.log(`📝 [Reminder] Found ${rows.length} due reminders`);
        return rows;

    } catch (error) {
        console.error("❌ [Reminder] Error fetching due reminders:", error.message);
        return [];
    }
};

// Function to send reminder data to RabbitMQ queue
const sendReminderToQueue = async (reminderData) => {
    try {
        if (!rabbitChannel) {
            console.error("❌ [Reminder] RabbitMQ channel not available");
            return false;
        }

        const message = {
            id: reminderData.id,
            title: reminderData.title,
            message: reminderData.message,
            reminder_time: reminderData.reminder_time,
            reminder_date: reminderData.reminder_date,
            recipient_name: reminderData.recipient_name,
            recipient_phone: reminderData.recipient_phone,
            sender_name: reminderData.sender_name,
            sender_phone: reminderData.sender_phone,
            reminder_type: reminderData.reminder_type,
            final_message: `Hi ${reminderData.sender_name},\n\n${reminderData.message}\n\nregards,\n${reminderData.recipient_name}`,
            timestamp: new Date().toISOString()
        };

        await rabbitChannel.sendToQueue(
            REMINDER_QUEUE,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );

        console.log(`📤 [Reminder] Sent to queue: ${reminderData.title}`);
        return true;

    } catch (error) {
        console.error("❌ [Reminder] Error sending to queue:", error.message);
        return false;
    }
};

// Improved queue consumer with error recovery
const consumeReminderQueue = async () => {
    try {
        if (!rabbitChannel) {
            console.error("❌ [Reminder] RabbitMQ channel not available for consuming");
            return;
        }

        await rabbitChannel.consume(REMINDER_QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const reminderData = JSON.parse(msg.content.toString());
                    console.log(`📥 [Reminder] Processing from queue: ${reminderData.title}`);

                    // Update status first to prevent race conditions
                    await updateReminderStatus(reminderData.id, 'processing');

                    // Send to webhook
                    await sendReminderToWebhook(reminderData);

                    // Update reminder status to 'sent'
                    await updateReminderStatus(reminderData.id, 'sent');

                    // Acknowledge the message
                    rabbitChannel.ack(msg);

                } catch (error) {
                    console.error("❌ [Reminder] Error processing message:", error.message);

                    // Reset status on failure
                    try {
                        const reminderData = JSON.parse(msg.content.toString());
                        await updateReminderStatus(reminderData.id, 'failed');
                    } catch (parseError) {
                        console.error("❌ [Reminder] Could not parse message for status update:", parseError.message);
                    }

                    // Reject and requeue the message
                    rabbitChannel.nack(msg, false, true);
                }
            }
        });

        console.log("🔄 [Reminder] Queue consumer started");

    } catch (error) {
        console.error("❌ [Reminder] Error setting up queue consumer:", error.message);

        // Retry consumer setup after delay
        if (!isShuttingDown) {
            setTimeout(() => {
                console.log("🔄 [Reminder] Retrying consumer setup...");
                consumeReminderQueue();
            }, 5000);
        }
    }
};

// Enhanced status update with better error handling
const updateReminderStatus = async (reminderId, status) => {
    try {
        if (!pool) {
            console.error('❌ [Reminder] Database connection not available for status update');
            return false;
        }

        const result = await pool.query(
            "UPDATE reminders SET status = $1, sent_at = $2 WHERE id = $3 RETURNING id",
            [status, new Date(), reminderId]
        );

        if (result.rowCount === 0) {
            console.warn(`⚠️ [Reminder] No reminder found with ID: ${reminderId}`);
            return false;
        }

        console.log(`✅ [Reminder] Status updated to '${status}' for ID: ${reminderId}`);
        return true;
    } catch (error) {
        console.error(`❌ [Reminder] Error updating status:`, error.message);
        return false;
    }
};

// Function to send reminder to webhook
const sendReminderToWebhook = async (reminderData) => {
    try {
        const encodedMessage = encodeURIComponent(reminderData.final_message);
        const whatsappLink = `https://wa.me/${reminderData.sender_phone}?text=${encodedMessage}`;

        const payload = {
            id: reminderData.id,
            title: reminderData.title,
            message: reminderData.message,
            recipient_name: reminderData.recipient_name,
            recipient_phone: reminderData.recipient_phone,
            sender_name: reminderData.sender_name,
            sender_phone: reminderData.sender_phone,
            reminder_type: reminderData.reminder_type,
            reminder_time: reminderData.reminder_time,
            reminder_date: reminderData.reminder_date,
            final_message: reminderData.final_message,
            whatsapp_link: whatsappLink,
            timestamp: reminderData.timestamp
        };

        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                "Content-Type": "application/json"
            },
            timeout: 10000
        });

        console.log(`✅ [Reminder] Sent to webhook: ${reminderData.title}`);
        console.log(`🔗 [Reminder] Webhook Response Status: ${response.status}`);

    } catch (error) {
        console.error(`❌ [Reminder] Error sending webhook for ${reminderData.title}:`,
            error.response ? error.response.data : error.message);
        throw error; // Re-throw to handle in queue consumer
    }
};

// Enhanced reminder processing with better error handling
const processDueReminders = async () => {
    try {
        console.log("⏰ [Reminder] Starting processing...");

        const reminders = await getDueReminders();

        if (reminders.length === 0) {
            console.log("😔 [Reminder] No due reminders found");
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Send each reminder to the queue
        for (const reminder of reminders) {
            try {
                const success = await sendReminderToQueue(reminder);
                if (success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error(`❌ [Reminder] Error processing reminder ${reminder.id}:`, error.message);
                errorCount++;
            }

            // Small delay to prevent overwhelming the queue
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`⏰ [Reminder] Processing completed: ${successCount} sent, ${errorCount} failed`);

    } catch (error) {
        console.error("❌ [Reminder] Error processing reminders:", error.message);
    }
};

// Route: Manually trigger reminder processing
router.post("/process", async (req, res) => {
    try {
        await processDueReminders();
        res.status(200).json({
            success: true,
            message: "Reminder processing initiated successfully",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Reminder] Error in manual processing:", error.message);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: error.message
        });
    }
});

// Route: Add a new reminder
router.post("/add", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                success: false,
                error: "Database connection not available"
            });
        }

        const {
            title,
            message,
            reminder_time,
            reminder_date,
            recipient_name,
            recipient_phone,
            sender_name,
            // sender_phone, 
            reminder_type,
            schemaName
        } = req.body;
        var sender_phone;

        console.log("sender_name",sender_name);
        const result = await pool.query(
            `SELECT sender_phone FROM ${schemaName}.reminders WHERE sender_name = $1 LIMIT 1`,
            [sender_name]
        );
        sender_phone = result.rows[0]?.sender_phone || null;
        console.log(sender_phone);
        console.log(result);
        if (!sender_phone) {
            return res.status(404).json({
                success: false,
                error: "Sender phone not found"
            });
        }

        // Validate required fields
        const requiredFields = ['title', 'message', 'reminder_time', 'reminder_date', 'recipient_name', 'recipient_phone', 'sender_name'];
        const missingFields = requiredFields.filter(field => !req.body[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
                missing: missingFields
            });
        }

        // Validate date format
        if (!moment(reminder_date, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({
                success: false,
                error: "Invalid date format. Use YYYY-MM-DD"
            });
        }

        // Validate time format
        if (!moment(reminder_time, 'HH:mm', true).isValid()) {
            return res.status(400).json({
                success: false,
                error: "Invalid time format. Use HH:mm (24-hour format)"
            });
        }

        // Convert IST time to UTC by subtracting 5:30
        const istDateTime = moment.tz(`${reminder_date} ${reminder_time}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
        const utcDateTime = istDateTime.utc();

        const convertedTime = utcDateTime.format('HH:mm');
        const convertedDate = utcDateTime.format('YYYY-MM-DD');

        console.log(`🕐 [Reminder] Original IST time: ${reminder_date} ${reminder_time}`);
        console.log(`🕐 [Reminder] Converted UTC time: ${convertedDate} ${convertedTime}`);

        await pool.query(
            `INSERT INTO reminders 
            (title, message, reminder_time, reminder_date, recipient_name, recipient_phone, sender_name, sender_phone, reminder_type, status, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [title, message, convertedTime, convertedDate, recipient_name, recipient_phone, sender_name, sender_phone, reminder_type || 'general', 'pending', new Date()]
        );

        res.status(201).json({
            success: true,
            message: "Reminder added successfully",
            original_time: `${reminder_date} ${reminder_time} IST`,
            stored_time: `${convertedDate} ${convertedTime} UTC`
        });
    } catch (error) {
        console.error("[Reminder] Error adding reminder:", error.message);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: error.message
        });
    }
});

// Route: Get all reminders
router.get("/list", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                success: false,
                error: "Database connection not available"
            });
        }

        const { rows } = await pool.query("SELECT * FROM reminders ORDER BY reminder_date, reminder_time");
        res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("[Reminder] Error fetching reminders:", error.message);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: error.message
        });
    }
});

// Route: Get today's reminders
router.get("/today", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                success: false,
                error: "Database connection not available"
            });
        }

        const today = moment().format('YYYY-MM-DD');
        const { rows } = await pool.query(
            "SELECT * FROM reminders WHERE reminder_date = $1 ORDER BY reminder_time",
            [today]
        );
        res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("[Reminder] Error fetching today's reminders:", error.message);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: error.message
        });
    }
});

// Route: Get pending reminders
router.get("/pending", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                success: false,
                error: "Database connection not available"
            });
        }

        const { rows } = await pool.query(
            "SELECT * FROM reminders WHERE status = 'pending' ORDER BY reminder_date, reminder_time"
        );
        res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("[Reminder] Error fetching pending reminders:", error.message);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: error.message
        });
    }
});

// Route: Update reminder status
router.patch("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'sent', 'cancelled', 'processing', 'failed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: "Invalid status",
                validStatuses: validStatuses
            });
        }

        const success = await updateReminderStatus(id, status);
        if (success) {
            res.status(200).json({
                success: true,
                message: "Reminder status updated successfully"
            });
        } else {
            res.status(404).json({
                success: false,
                error: "Reminder not found"
            });
        }
    } catch (error) {
        console.error("[Reminder] Error updating reminder status:", error.message);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: error.message
        });
    }
});

// Route: Delete a reminder
router.delete("/:id", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                success: false,
                error: "Database connection not available"
            });
        }

        const { id } = req.params;
        const result = await pool.query("DELETE FROM reminders WHERE id = $1 RETURNING id", [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: "Reminder not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Reminder deleted successfully"
        });
    } catch (error) {
        console.error("[Reminder] Error deleting reminder:", error.message);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: error.message
        });
    }
});

// Route: Get queue status
router.get("/queue/status", async (req, res) => {
    try {
        if (!rabbitChannel) {
            return res.status(503).json({
                success: false,
                error: "RabbitMQ not connected"
            });
        }

        const queueInfo = await rabbitChannel.checkQueue(REMINDER_QUEUE);
        res.status(200).json({
            success: true,
            queue: REMINDER_QUEUE,
            messageCount: queueInfo.messageCount,
            consumerCount: queueInfo.consumerCount
        });
    } catch (error) {
        console.error("[Reminder] Error checking queue status:", error.message);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: error.message
        });
    }
});

// Graceful shutdown (internal function)
const gracefulShutdown = async () => {
    console.log("🛑 [Reminder] Shutting down gracefully...");
    isShuttingDown = true;

    try {
        if (rabbitChannel) {
            await rabbitChannel.close();
            console.log("✅ [Reminder] RabbitMQ channel closed");
        }
        if (rabbitConnection) {
            await rabbitConnection.close();
            console.log("✅ [Reminder] RabbitMQ connection closed");
        }

        console.log("✅ [Reminder] System connections closed");
    } catch (error) {
        console.error("❌ [Reminder] Error during shutdown:", error.message);
    }
};

// REMOVED: Global process event handlers (handled by main server)

// Schedule reminder processing - runs every 5 minutes
cron.schedule("*/5 * * * *", async () => {
    try {
        console.log("⏰ [Reminder] Scheduled processing started at", new Date().toLocaleString());
        await processDueReminders();
    } catch (error) {
        console.error("❌ [Reminder] Error in scheduled processing:", error.message);
    }
});

console.log("⏰ [Reminder] Notification system initializing...");

// Initialize the reminder system
const startReminderSystem = async () => {
    try {
        // Initialize RabbitMQ with retry logic
        await initRabbitMQ();

        console.log("📅 [Reminder] Notification system started successfully!");
        console.log("⏰ [Reminder] Processing scheduled every 5 minutes");

    } catch (error) {
        console.error("❌ [Reminder] Failed to start system:", error.message);
        throw error; // Let the main server handle this
    }
};

// Export the router and functions
module.exports = {
    router,
    startReminderSystem,
    processDueReminders,
    gracefulShutdown
};

// Auto-start if this file is run directly
if (require.main === module) {
    const express = require('express');
    const app = express();

    app.use(express.json());
    app.use('/reminder', router);

    startReminderSystem().then(() => {
        app.listen(3001, () => {
            console.log('🚀 [Reminder] System running on port 3001');
        });
    }).catch(error => {
        console.error('[Reminder] Failed to start system:', error);
        process.exit(1);
    });
}