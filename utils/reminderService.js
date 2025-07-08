// const amqp = require('amqplib');
// const express = require("express");
// const bodyParser = require("body-parser");
// const cron = require("node-cron");
// const axios = require("axios");
// const moment = require("moment-timezone");
// const pool = require('../database/databaseConnection');

// const router = express.Router();
// router.use(bodyParser.urlencoded({ extended: false }));
// router.use(bodyParser.json());

// let apiCallCount = 0;

// router.use((req, res, next) => {
//     apiCallCount++;
//     console.log(`Total API Calls: ${apiCallCount}`);
//     next();
// });

// // RabbitMQ connection variables
// let rabbitConnection = null;
// let rabbitChannel = null;

// const REMINDER_QUEUE = 'reminder_notifications';
// const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://webhooks.wa.expert/webhook/686cd5afe3591ae351cc2970";

// // Initialize RabbitMQ connection with retry logic
// const initRabbitMQ = async (retries = 5, delay = 2000) => {
//     for (let i = 0; i < retries; i++) {
//         try {
//             console.log(`🔄 Attempting RabbitMQ connection (attempt ${i + 1}/${retries})...`);
            
//             rabbitConnection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
//             rabbitChannel = await rabbitConnection.createChannel();
            
//             // Declare the reminder queue
//             await rabbitChannel.assertQueue(REMINDER_QUEUE, { durable: true });
            
//             console.log("✅ RabbitMQ connected and queue declared");
            
//             // Start consuming messages from the queue
//             consumeReminderQueue();
//             return; 
            
//         } catch (error) {
//             console.log(`❌ Connection attempt ${i + 1} failed:`, error.message);
            
//             if (i === retries - 1) {
//                 console.error("❌ Failed to connect to RabbitMQ after all retries");
//                 throw error;
//             }
            
//             console.log(`⏳ Waiting ${delay}ms before retry...`);
//             await new Promise(resolve => setTimeout(resolve, delay));
//         }
//     }
// };

// // Function to get due reminders from database
// const getDueReminders = async () => {
//     try {
//         // Get current time
//         const now = moment();
//         const currentTime = now.format('HH:mm');
//         const currentDate = now.format('YYYY-MM-DD');
        
//         console.log(`⏰ Checking for reminders at: ${currentDate} ${currentTime}`);
        
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
//             AND reminder_time <= $2
//             AND status = 'pending'
//             ORDER BY reminder_time ASC
//         `;
        
//         const { rows } = await pool.query(query, [currentDate, currentTime]);
        
//         console.log(`📝 Found ${rows.length} due reminders`);
//         return rows;
        
//     } catch (error) {
//         console.error("❌ Error fetching due reminders:", error);
//         return [];
//     }
// };

// // Function to send reminder data to RabbitMQ queue
// const sendReminderToQueue = async (reminderData) => {
//     try {
//         if (!rabbitChannel) {
//             console.error("❌ RabbitMQ channel not available");
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

//         console.log(`📤 Reminder sent to queue: ${reminderData.title}`);
//         return true;

//     } catch (error) {
//         console.error("❌ Error sending reminder to queue:", error);
//         return false;
//     }
// };

// // Function to consume messages from reminder queue and send to webhook
// const consumeReminderQueue = async () => {
//     try {
//         if (!rabbitChannel) {
//             console.error("❌ RabbitMQ channel not available for consuming");
//             return;
//         }

//         await rabbitChannel.consume(REMINDER_QUEUE, async (msg) => {
//             if (msg !== null) {
//                 try {
//                     const reminderData = JSON.parse(msg.content.toString());
//                     console.log(`📥 Processing reminder from queue: ${reminderData.title}`);
                    
//                     // Send to webhook
//                     await sendReminderToWebhook(reminderData);
                    
//                     // Update reminder status to 'sent'
//                     await updateReminderStatus(reminderData.id, 'sent');
                    
//                     // Acknowledge the message
//                     rabbitChannel.ack(msg);
                    
//                 } catch (error) {
//                     console.error("❌ Error processing reminder message:", error);
//                     // Reject and requeue the message
//                     rabbitChannel.nack(msg, false, true);
//                 }
//             }
//         });

//         console.log("🔄 Reminder queue consumer started");

//     } catch (error) {
//         console.error("❌ Error setting up queue consumer:", error);
//     }
// };

// // Function to update reminder status
// const updateReminderStatus = async (reminderId, status) => {
//     try {
//         await pool.query(
//             "UPDATE reminders SET status = $1, sent_at = $2 WHERE id = $3",
//             [status, new Date(), reminderId]
//         );
//         console.log(`✅ Reminder ${reminderId} status updated to: ${status}`);
//     } catch (error) {
//         console.error(`❌ Error updating reminder status:`, error);
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
//             timeout: 10000 // 10 second timeout
//         });

//         console.log(`✅ Reminder sent to webhook: ${reminderData.title}`);
//         console.log("🔗 Webhook Response Status:", response.status);

//     } catch (error) {
//         console.error(`❌ Error sending reminder webhook for ${reminderData.title}:`, 
//             error.response ? error.response.data : error.message);
//         throw error; // Re-throw to handle in queue consumer
//     }
// };

// // Main function to process due reminders
// const processDueReminders = async () => {
//     try {
//         console.log("⏰ Starting reminder processing...");
        
//         const reminders = await getDueReminders();
        
//         if (reminders.length === 0) {
//             console.log("😔 No due reminders found");
//             return;
//         }

//         let successCount = 0;
//         let errorCount = 0;

//         // Send each reminder to the queue
//         for (const reminder of reminders) {
//             const success = await sendReminderToQueue(reminder);
//             if (success) {
//                 successCount++;
//             } else {
//                 errorCount++;
//             }
            
//             // Small delay to prevent overwhelming the queue
//             await new Promise(resolve => setTimeout(resolve, 100));
//         }

//         console.log(`⏰ Reminder processing completed: ${successCount} sent, ${errorCount} failed`);

//     } catch (error) {
//         console.error("❌ Error processing reminders:", error);
//     }
// };

// // API endpoint to manually trigger reminder processing
// router.post("/process", async (req, res) => {
//     try {
//         await processDueReminders();
//         res.status(200).json({ 
//             message: "Reminder processing initiated successfully",
//             timestamp: new Date().toISOString()
//         });
//     } catch (error) {
//         console.error("Error in manual reminder processing:", error);
//         res.status(500).json({ 
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // API endpoint to add a new reminder
// router.post("/add", async (req, res) => {
//     try {
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
        
//         if (!title || !message || !reminder_time || !reminder_date || !recipient_name || !recipient_phone || !sender_name || !sender_phone) {
//             return res.status(400).json({ error: "All fields are required" });
//         }

//         // Validate date format
//         if (!moment(reminder_date, 'YYYY-MM-DD', true).isValid()) {
//             return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
//         }

//         // Validate time format
//         if (!moment(reminder_time, 'HH:mm', true).isValid()) {
//             return res.status(400).json({ error: "Invalid time format. Use HH:mm (24-hour format)" });
//         }

//         await pool.query(
//             `INSERT INTO reminders 
//             (title, message, reminder_time, reminder_date, recipient_name, recipient_phone, sender_name, sender_phone, reminder_type, status, created_at) 
//             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
//             [title, message, reminder_time, reminder_date, recipient_name, recipient_phone, sender_name, sender_phone, reminder_type || 'general', 'pending', new Date()]
//         );

//         res.status(201).json({ message: "Reminder added successfully" });
//     } catch (error) {
//         console.error("Error adding reminder:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // API endpoint to get all reminders
// router.get("/list", async (req, res) => {
//     try {
//         const { rows } = await pool.query("SELECT * FROM reminders ORDER BY reminder_date, reminder_time");
//         res.status(200).json(rows);
//     } catch (error) {
//         console.error("Error fetching reminders:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // API endpoint to get today's reminders
// router.get("/today", async (req, res) => {
//     try {
//         const today = moment().format('YYYY-MM-DD');
//         const { rows } = await pool.query(
//             "SELECT * FROM reminders WHERE reminder_date = $1 ORDER BY reminder_time",
//             [today]
//         );
//         res.status(200).json(rows);
//     } catch (error) {
//         console.error("Error fetching today's reminders:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // API endpoint to get pending reminders
// router.get("/pending", async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             "SELECT * FROM reminders WHERE status = 'pending' ORDER BY reminder_date, reminder_time"
//         );
//         res.status(200).json(rows);
//     } catch (error) {
//         console.error("Error fetching pending reminders:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // API endpoint to update reminder status
// router.patch("/:id/status", async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status } = req.body;
        
//         if (!['pending', 'sent', 'cancelled'].includes(status)) {
//             return res.status(400).json({ error: "Invalid status. Use: pending, sent, or cancelled" });
//         }

//         await updateReminderStatus(id, status);
//         res.status(200).json({ message: "Reminder status updated successfully" });
//     } catch (error) {
//         console.error("Error updating reminder status:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // API endpoint to delete a reminder
// router.delete("/:id", async (req, res) => {
//     try {
//         const { id } = req.params;
//         await pool.query("DELETE FROM reminders WHERE id = $1", [id]);
//         res.status(200).json({ message: "Reminder deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting reminder:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // API endpoint to get queue status
// router.get("/queue/status", async (req, res) => {
//     try {
//         if (!rabbitChannel) {
//             return res.status(503).json({ error: "RabbitMQ not connected" });
//         }

//         const queueInfo = await rabbitChannel.checkQueue(REMINDER_QUEUE);
//         res.status(200).json({
//             queue: REMINDER_QUEUE,
//             messageCount: queueInfo.messageCount,
//             consumerCount: queueInfo.consumerCount
//         });
//     } catch (error) {
//         console.error("Error checking queue status:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // Graceful shutdown
// const gracefulShutdown = async () => {
//     console.log("🛑 Shutting down gracefully...");
    
//     try {
//         if (rabbitChannel) {
//             await rabbitChannel.close();
//         }
//         if (rabbitConnection) {
//             await rabbitConnection.close();
//         }
//         await pool.end();
//         console.log("✅ All connections closed");
//         process.exit(0);
//     } catch (error) {
//         console.error("❌ Error during shutdown:", error);
//         process.exit(1);
//     }
// };

// // Handle shutdown signals
// process.on('SIGINT', gracefulShutdown);
// process.on('SIGTERM', gracefulShutdown);

// // Schedule reminder processing - runs every 5 minutes
// cron.schedule("*/5 * * * *", () => {
//     console.log("⏰ Scheduled reminder processing started at", new Date().toLocaleString());
//     processDueReminders();
// });

// console.log("⏰ Reminder notification system starting...");

// // Initialize the application
// const startReminderSystem = async () => {
//     try {
//         // Initialize RabbitMQ with retry logic
//         await initRabbitMQ();
        
//         console.log("📅 Reminder notification system started successfully!");
//         console.log("⏰ Reminder processing scheduled every 5 minutes");
        
//     } catch (error) {
//         console.error("❌ Failed to start reminder system:", error);
//         process.exit(1);
//     }
// };

// // Export the router and start function
// module.exports = {
//     router,
//     startReminderSystem
// };

// // Auto-start if this file is run directly
// if (require.main === module) {
//     startReminderSystem();
// }


const amqp = require('amqplib');
require("dotenv").config(); // FIX 1: Added back dotenv
const express = require("express");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment-timezone");
const pool = require('../database/databaseConnection');

const router = express.Router();
router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

let apiCallCount = 0;

router.use((req, res, next) => {
    apiCallCount++;
    console.log(`Total API Calls: ${apiCallCount}`);
    next();
});

// RabbitMQ connection variables
let rabbitConnection = null;
let rabbitChannel = null;
let isShuttingDown = false; // FIX: Added shutdown flag

const REMINDER_QUEUE = 'reminder_notifications';
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://webhooks.wa.expert/webhook/686cd5afe3591ae351cc2970";

// Initialize RabbitMQ connection with retry logic
const initRabbitMQ = async (retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`🔄 Attempting RabbitMQ connection (attempt ${i + 1}/${retries})...`);
            
            rabbitConnection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
            rabbitChannel = await rabbitConnection.createChannel();
            
            // FIX: Added connection error handlers
            rabbitConnection.on('error', (err) => {
                if (!isShuttingDown) {
                    console.error('❌ RabbitMQ connection error:', err);
                }
            });
            
            rabbitConnection.on('close', () => {
                if (!isShuttingDown) {
                    console.log('⚠️ RabbitMQ connection closed, attempting to reconnect...');
                    setTimeout(() => initRabbitMQ(), 5000);
                }
            });
            
            // Declare the reminder queue
            await rabbitChannel.assertQueue(REMINDER_QUEUE, { durable: true });
            
            console.log("✅ RabbitMQ connected and queue declared");
            
            // Start consuming messages from the queue
            consumeReminderQueue();
            return; 
            
        } catch (error) {
            console.log(`❌ Connection attempt ${i + 1} failed:`, error.message);
            
            if (i === retries - 1) {
                console.error("❌ Failed to connect to RabbitMQ after all retries");
                throw error;
            }
            
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// FIX 2: Improved time-based reminder fetching to prevent duplicates
const getDueReminders = async () => {
    try {
        // Get current time with timezone awareness
        const now = moment().tz(process.env.TIMEZONE || 'UTC');
        const currentTime = now.format('HH:mm');
        const currentDate = now.format('YYYY-MM-DD');
        const lastCheckTime = now.subtract(5, 'minutes').format('HH:mm');
        
        console.log(`⏰ Checking for reminders at: ${currentDate} ${currentTime}`);
        
        // FIX: Better query to prevent duplicate processing
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
        
        console.log(`📝 Found ${rows.length} due reminders`);
        return rows;
        
    } catch (error) {
        console.error("❌ Error fetching due reminders:", error);
        return [];
    }
};

// Function to send reminder data to RabbitMQ queue
const sendReminderToQueue = async (reminderData) => {
    try {
        if (!rabbitChannel) {
            console.error("❌ RabbitMQ channel not available");
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
            final_message: `⏰ Reminder: ${reminderData.title}\n\n${reminderData.message}\n\nFrom: ${reminderData.sender_name}`,
            timestamp: new Date().toISOString()
        };

        await rabbitChannel.sendToQueue(
            REMINDER_QUEUE, 
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );

        console.log(`📤 Reminder sent to queue: ${reminderData.title}`);
        return true;

    } catch (error) {
        console.error("❌ Error sending reminder to queue:", error);
        return false;
    }
};

// FIX 3: Improved queue consumer with error recovery
const consumeReminderQueue = async () => {
    try {
        if (!rabbitChannel) {
            console.error("❌ RabbitMQ channel not available for consuming");
            return;
        }

        await rabbitChannel.consume(REMINDER_QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const reminderData = JSON.parse(msg.content.toString());
                    console.log(`📥 Processing reminder from queue: ${reminderData.title}`);
                    
                    // FIX: Update status first to prevent race conditions
                    await updateReminderStatus(reminderData.id, 'processing');
                    
                    // Send to webhook
                    await sendReminderToWebhook(reminderData);
                    
                    // Update reminder status to 'sent'
                    await updateReminderStatus(reminderData.id, 'sent');
                    
                    // Acknowledge the message
                    rabbitChannel.ack(msg);
                    
                } catch (error) {
                    console.error("❌ Error processing reminder message:", error);
                    
                    // FIX: Reset status on failure
                    try {
                        const reminderData = JSON.parse(msg.content.toString());
                        await updateReminderStatus(reminderData.id, 'failed');
                    } catch (parseError) {
                        console.error("❌ Could not parse message for status update:", parseError);
                    }
                    
                    // Reject and requeue the message (with limit)
                    rabbitChannel.nack(msg, false, true);
                }
            }
        });

        console.log("🔄 Reminder queue consumer started");

    } catch (error) {
        console.error("❌ Error setting up queue consumer:", error);
        
        // FIX: Retry consumer setup after delay
        if (!isShuttingDown) {
            setTimeout(() => {
                console.log("🔄 Retrying consumer setup...");
                consumeReminderQueue();
            }, 5000);
        }
    }
};

// FIX 4: Enhanced status update with better error handling
const updateReminderStatus = async (reminderId, status) => {
    try {
        const result = await pool.query(
            "UPDATE reminders SET status = $1, sent_at = $2 WHERE id = $3 RETURNING id",
            [status, new Date(), reminderId]
        );
        
        if (result.rowCount === 0) {
            console.warn(`⚠️ No reminder found with ID: ${reminderId}`);
            return false;
        }
        
        console.log(`✅ Reminder ${reminderId} status updated to: ${status}`);
        return true;
    } catch (error) {
        console.error(`❌ Error updating reminder status:`, error);
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
            timeout: 10000 // 10 second timeout
        });

        console.log(`✅ Reminder sent to webhook: ${reminderData.title}`);
        console.log("🔗 Webhook Response Status:", response.status);

    } catch (error) {
        console.error(`❌ Error sending reminder webhook for ${reminderData.title}:`, 
            error.response ? error.response.data : error.message);
        throw error; // Re-throw to handle in queue consumer
    }
};

// FIX 5: Enhanced reminder processing with better error handling
const processDueReminders = async () => {
    try {
        console.log("⏰ Starting reminder processing...");
        
        const reminders = await getDueReminders();
        
        if (reminders.length === 0) {
            console.log("😔 No due reminders found");
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
                console.error(`❌ Error processing reminder ${reminder.id}:`, error);
                errorCount++;
            }
            
            // Small delay to prevent overwhelming the queue
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`⏰ Reminder processing completed: ${successCount} sent, ${errorCount} failed`);

    } catch (error) {
        console.error("❌ Error processing reminders:", error);
    }
};

// API endpoint to manually trigger reminder processing
router.post("/process", async (req, res) => {
    try {
        await processDueReminders();
        res.status(200).json({ 
            message: "Reminder processing initiated successfully",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error in manual reminder processing:", error);
        res.status(500).json({ 
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// API endpoint to add a new reminder
router.post("/add", async (req, res) => {
    try {
        const { 
            title, 
            message, 
            reminder_time, 
            reminder_date, 
            recipient_name, 
            recipient_phone, 
            sender_name, 
            sender_phone, 
            reminder_type 
        } = req.body;
        
        if (!title || !message || !reminder_time || !reminder_date || !recipient_name || !recipient_phone || !sender_name || !sender_phone) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Validate date format
        if (!moment(reminder_date, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }

        // Validate time format
        if (!moment(reminder_time, 'HH:mm', true).isValid()) {
            return res.status(400).json({ error: "Invalid time format. Use HH:mm (24-hour format)" });
        }

        await pool.query(
            `INSERT INTO reminders 
            (title, message, reminder_time, reminder_date, recipient_name, recipient_phone, sender_name, sender_phone, reminder_type, status, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [title, message, reminder_time, reminder_date, recipient_name, recipient_phone, sender_name, sender_phone, reminder_type || 'general', 'pending', new Date()]
        );

        res.status(201).json({ message: "Reminder added successfully" });
    } catch (error) {
        console.error("Error adding reminder:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to get all reminders
router.get("/list", async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM reminders ORDER BY reminder_date, reminder_time");
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching reminders:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to get today's reminders
router.get("/today", async (req, res) => {
    try {
        const today = moment().format('YYYY-MM-DD');
        const { rows } = await pool.query(
            "SELECT * FROM reminders WHERE reminder_date = $1 ORDER BY reminder_time",
            [today]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching today's reminders:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to get pending reminders
router.get("/pending", async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM reminders WHERE status = 'pending' ORDER BY reminder_date, reminder_time"
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching pending reminders:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to update reminder status
router.patch("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['pending', 'sent', 'cancelled', 'processing', 'failed'].includes(status)) {
            return res.status(400).json({ error: "Invalid status. Use: pending, sent, cancelled, processing, or failed" });
        }

        const success = await updateReminderStatus(id, status);
        if (success) {
            res.status(200).json({ message: "Reminder status updated successfully" });
        } else {
            res.status(404).json({ error: "Reminder not found" });
        }
    } catch (error) {
        console.error("Error updating reminder status:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to delete a reminder
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM reminders WHERE id = $1 RETURNING id", [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Reminder not found" });
        }
        
        res.status(200).json({ message: "Reminder deleted successfully" });
    } catch (error) {
        console.error("Error deleting reminder:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to get queue status
router.get("/queue/status", async (req, res) => {
    try {
        if (!rabbitChannel) {
            return res.status(503).json({ error: "RabbitMQ not connected" });
        }

        const queueInfo = await rabbitChannel.checkQueue(REMINDER_QUEUE);
        res.status(200).json({
            queue: REMINDER_QUEUE,
            messageCount: queueInfo.messageCount,
            consumerCount: queueInfo.consumerCount
        });
    } catch (error) {
        console.error("Error checking queue status:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// FIX 6: Improved graceful shutdown
const gracefulShutdown = async () => {
    console.log("🛑 Shutting down gracefully...");
    isShuttingDown = true;
    
    try {
        // Stop accepting new connections first
        if (rabbitChannel) {
            await rabbitChannel.close();
            console.log("✅ RabbitMQ channel closed");
        }
        if (rabbitConnection) {
            await rabbitConnection.close();
            console.log("✅ RabbitMQ connection closed");
        }
        
        // Wait a bit for ongoing operations to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await pool.end();
        console.log("✅ Database pool closed");
        console.log("✅ All connections closed");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// FIX 7: Enhanced cron job with error handling
cron.schedule("*/5 * * * *", async () => {
    try {
        console.log("⏰ Scheduled reminder processing started at", new Date().toLocaleString());
        await processDueReminders();
    } catch (error) {
        console.error("❌ Error in scheduled reminder processing:", error);
    }
});

console.log("⏰ Reminder notification system starting...");

// Initialize the application
const startReminderSystem = async () => {
    try {
        // Initialize RabbitMQ with retry logic
        await initRabbitMQ();
        
        console.log("📅 Reminder notification system started successfully!");
        console.log("⏰ Reminder processing scheduled every 5 minutes");
        
    } catch (error) {
        console.error("❌ Failed to start reminder system:", error);
        process.exit(1);
    }
};

// Export the router and start function
module.exports = {
    router,
    startReminderSystem
};

// Auto-start if this file is run directly
if (require.main === module) {
    startReminderSystem();
}