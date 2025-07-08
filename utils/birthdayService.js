// 

const amqp = require('amqplib');
require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment-timezone");

// Use absolute path or handle the import more safely
let pool;
try {
    pool = require('../database/databaseConnection');
} catch (error) {
    console.error('❌ Failed to import database connection:', error.message);
    // You might want to handle this differently based on your app structure
}

const router = express.Router();

// REMOVED: Body parser middleware (should be handled at app level)
// REMOVED: API call counter (should be handled at app level if needed)

// RabbitMQ connection variables
let rabbitConnection = null;
let rabbitChannel = null;
let isShuttingDown = false;

const BIRTHDAY_QUEUE = 'birthday_reminders';
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://webhooks.wa.expert/webhook/67ebdd419a714c7c4697f64d";

// Initialize RabbitMQ connection with retry logic
const initRabbitMQ = async (retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`🔄 [Birthday] Attempting RabbitMQ connection (attempt ${i + 1}/${retries})...`);
            
            rabbitConnection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
            rabbitChannel = await rabbitConnection.createChannel();
            
            // Add connection error handlers
            rabbitConnection.on('error', (err) => {
                if (!isShuttingDown) {
                    console.error('❌ [Birthday] RabbitMQ connection error:', err.message);
                }
            });
            
            rabbitConnection.on('close', () => {
                if (!isShuttingDown) {
                    console.log('⚠️ [Birthday] RabbitMQ connection closed, attempting to reconnect...');
                    setTimeout(() => initRabbitMQ(), 5000);
                }
            });
            
            // Declare the birthday queue
            await rabbitChannel.assertQueue(BIRTHDAY_QUEUE, { durable: true });
            
            console.log("✅ [Birthday] RabbitMQ connected and queue declared");
            
            // Start consuming messages from the queue
            consumeBirthdayQueue();
            return; 
            
        } catch (error) {
            console.log(`❌ [Birthday] Connection attempt ${i + 1} failed:`, error.message);
            
            if (i === retries - 1) {
                console.error("❌ [Birthday] Failed to connect to RabbitMQ after all retries");
                throw error;
            }
            
            console.log(`⏳ [Birthday] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Function to get today's birthdays from database
const getTodaysBirthdays = async () => {
    try {
        if (!pool) {
            throw new Error('Database connection not available');
        }

        // Get today's date in MM-DD format for birthday comparison
        const today = moment().format('MM-DD');
        
        console.log(`🎂 [Birthday] Checking for birthdays on: ${today}`);
        const query = `
            SELECT 
                id,
                name as receiver_name,
                phone as receiver_number,
                sender_name,
                sender_phone as send_to_number,
                birthday_date,
                special_day,
                EXTRACT(YEAR FROM AGE(birthday_date)) + 1 as age
            FROM birthdays 
            WHERE TO_CHAR(birthday_date, 'MM-DD') = $1
        `;
        
        const { rows } = await pool.query(query, [today]);
        
        console.log(`🎉 [Birthday] Found ${rows.length} birthdays for today`);
        return rows;
        
    } catch (error) {
        console.error("❌ [Birthday] Error fetching today's birthdays:", error.message);
        return [];
    }
};

// Function to send birthday data to RabbitMQ queue
const sendBirthdayToQueue = async (birthdayData) => {
    try {
        if (!rabbitChannel) {
            console.error("❌ [Birthday] RabbitMQ channel not available");
            return false;
        }

        const message = {
            receiver_name: birthdayData.receiver_name,
            receiver_number: birthdayData.receiver_number,
            sender_name: birthdayData.sender_name,
            send_to_number: birthdayData.send_to_number,
            birthday_date: birthdayData.birthday_date,
            age: birthdayData.age,
            special_day: birthdayData.special_day,
            message: `🎉 Happy ${birthdayData.special_day} ${birthdayData.receiver_name}! Wishing you a wonderful ${birthdayData.age}th ${birthdayData.special_day}! 🎂`,
            timestamp: new Date().toISOString()
        };

        await rabbitChannel.sendToQueue(
            BIRTHDAY_QUEUE, 
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );

        console.log(`📤 [Birthday] Reminder sent to queue for: ${birthdayData.receiver_name}`);
        return true;

    } catch (error) {
        console.error("❌ [Birthday] Error sending birthday to queue:", error.message);
        return false;
    }
};

// Function to consume messages from birthday queue and send to webhook
const consumeBirthdayQueue = async () => {
    try {
        if (!rabbitChannel) {
            console.error("❌ [Birthday] RabbitMQ channel not available for consuming");
            return;
        }

        await rabbitChannel.consume(BIRTHDAY_QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const birthdayData = JSON.parse(msg.content.toString());
                    console.log(`📥 [Birthday] Processing reminder from queue: ${birthdayData.receiver_name}`);
                    
                    // Send to webhook
                    await sendBirthdayToWebhook(birthdayData);
                    
                    // Acknowledge the message
                    rabbitChannel.ack(msg);
                    
                } catch (error) {
                    console.error("❌ [Birthday] Error processing birthday message:", error.message);
                    // Reject and requeue the message
                    rabbitChannel.nack(msg, false, true);
                }
            }
        });

        console.log("🔄 [Birthday] Queue consumer started");

    } catch (error) {
        console.error("❌ [Birthday] Error setting up queue consumer:", error.message);
        
        // Retry consumer setup after delay
        if (!isShuttingDown) {
            setTimeout(() => {
                console.log("🔄 [Birthday] Retrying consumer setup...");
                consumeBirthdayQueue();
            }, 5000);
        }
    }
};

// Function to send birthday reminder to webhook
const sendBirthdayToWebhook = async (birthdayData) => {
    try {
        const encodedMessage = encodeURIComponent(birthdayData.message);
        const finalMessage = `https://wa.me/${birthdayData.send_to_number}?text=${encodedMessage}`;

        const payload = {
            receiver_name: birthdayData.receiver_name,
            receiver_number: birthdayData.receiver_number,
            sender_name: birthdayData.sender_name,
            send_to_number: birthdayData.send_to_number,
            message: birthdayData.message,
            final_message: finalMessage,
            birthday_date: birthdayData.birthday_date,
            age: birthdayData.age,
            special_day: birthdayData.special_day,
            timestamp: birthdayData.timestamp
        };

        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                "Content-Type": "application/json"
            },
            timeout: 10000 // 10 second timeout
        });

        console.log(`✅ [Birthday] Reminder sent to webhook for: ${birthdayData.receiver_name}`);
        console.log("🔗 [Birthday] Webhook Response Status:", response.status);

    } catch (error) {
        console.error(`❌ [Birthday] Error sending webhook for ${birthdayData.receiver_name}:`, 
            error.response ? error.response.data : error.message);
        throw error; // Re-throw to handle in queue consumer
    }
};

// Main function to process today's birthdays
const processTodaysBirthdays = async () => {
    try {
        console.log("🎂 [Birthday] Starting birthday processing...");
        
        const birthdays = await getTodaysBirthdays();
        
        if (birthdays.length === 0) {
            console.log("😔 [Birthday] No birthdays found for today");
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Send each birthday to the queue
        for (const birthday of birthdays) {
            try {
                const success = await sendBirthdayToQueue(birthday);
                if (success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error(`❌ [Birthday] Error processing birthday ${birthday.id}:`, error.message);
                errorCount++;
            }
            
            // Small delay to prevent overwhelming the queue
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`🎉 [Birthday] Processing completed: ${successCount} sent, ${errorCount} failed`);

    } catch (error) {
        console.error("❌ [Birthday] Error processing birthdays:", error.message);
    }
};

// Route: Manually trigger birthday processing
router.post("/process", async (req, res) => {
    try {
        await processTodaysBirthdays();
        res.status(200).json({ 
            success: true,
            message: "Birthday processing initiated successfully",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Birthday] Error in manual processing:", error.message);
        res.status(500).json({ 
            success: false,
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// Route: Add a new birthday
router.post("/add", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ 
                success: false,
                error: "Database connection not available" 
            });
        }

        const { name, phone, birthday_date, sender_name, sender_phone, special_day } = req.body;
        
        // Validate required fields
        if (!name || !phone || !birthday_date || !sender_name || !sender_phone) {
            return res.status(400).json({ 
                success: false,
                error: "All fields are required",
                required: ["name", "phone", "birthday_date", "sender_name", "sender_phone"]
            });
        }

        // Validate date format
        if (!moment(birthday_date, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ 
                success: false,
                error: "Invalid date format. Use YYYY-MM-DD" 
            });
        }

        await pool.query(
            "INSERT INTO birthdays (name, phone, birthday_date, sender_name, sender_phone, special_day) VALUES ($1, $2, $3, $4, $5, $6)",
            [name, phone, birthday_date, sender_name, sender_phone, special_day || 'Birthday']
        );

        res.status(201).json({ 
            success: true,
            message: "Birthday added successfully" 
        });
    } catch (error) {
        console.error("[Birthday] Error adding birthday:", error.message);
        res.status(500).json({ 
            success: false,
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// Route: Get all birthdays
router.get("/list", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ 
                success: false,
                error: "Database connection not available" 
            });
        }

        const { rows } = await pool.query("SELECT * FROM birthdays ORDER BY birthday_date");
        res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("[Birthday] Error fetching birthdays:", error.message);
        res.status(500).json({ 
            success: false,
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// Route: Get today's birthdays
router.get("/today", async (req, res) => {
    try {
        const birthdays = await getTodaysBirthdays();
        res.status(200).json({
            success: true,
            data: birthdays,
            count: birthdays.length
        });
    } catch (error) {
        console.error("[Birthday] Error fetching today's birthdays:", error.message);
        res.status(500).json({ 
            success: false,
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// Route: Get upcoming birthdays (next 30 days)
router.get("/upcoming", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ 
                success: false,
                error: "Database connection not available" 
            });
        }

        const query = `
            SELECT 
                id,
                name as receiver_name,
                phone as receiver_number,
                sender_name,
                sender_phone as send_to_number,
                birthday_date,
                special_day,
                EXTRACT(YEAR FROM AGE(birthday_date)) + 1 as age,
                TO_CHAR(birthday_date, 'MM-DD') as birthday_mmdd
            FROM birthdays 
            WHERE TO_CHAR(birthday_date, 'MM-DD') >= TO_CHAR(CURRENT_DATE, 'MM-DD')
            AND TO_CHAR(birthday_date, 'MM-DD') <= TO_CHAR(CURRENT_DATE + INTERVAL '30 days', 'MM-DD')
            ORDER BY TO_CHAR(birthday_date, 'MM-DD')
        `;
        
        const { rows } = await pool.query(query);
        res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("[Birthday] Error fetching upcoming birthdays:", error.message);
        res.status(500).json({ 
            success: false,
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// Route: Update a birthday
router.put("/:id", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ 
                success: false,
                error: "Database connection not available" 
            });
        }

        const { id } = req.params;
        const { name, phone, birthday_date, sender_name, sender_phone, special_day } = req.body;
        
        if (!name || !phone || !birthday_date || !sender_name || !sender_phone) {
            return res.status(400).json({ 
                success: false,
                error: "All fields are required" 
            });
        }

        // Validate date format
        if (!moment(birthday_date, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ 
                success: false,
                error: "Invalid date format. Use YYYY-MM-DD" 
            });
        }

        const result = await pool.query(
            "UPDATE birthdays SET name = $1, phone = $2, birthday_date = $3, sender_name = $4, sender_phone = $5, special_day = $6 WHERE id = $7 RETURNING id",
            [name, phone, birthday_date, sender_name, sender_phone, special_day, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false,
                error: "Birthday not found" 
            });
        }

        res.status(200).json({ 
            success: true,
            message: "Birthday updated successfully" 
        });
    } catch (error) {
        console.error("[Birthday] Error updating birthday:", error.message);
        res.status(500).json({ 
            success: false,
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// Route: Delete a birthday
router.delete("/:id", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ 
                success: false,
                error: "Database connection not available" 
            });
        }

        const { id } = req.params;
        const result = await pool.query("DELETE FROM birthdays WHERE id = $1 RETURNING id", [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false,
                error: "Birthday not found" 
            });
        }
        
        res.status(200).json({ 
            success: true,
            message: "Birthday deleted successfully" 
        });
    } catch (error) {
        console.error("[Birthday] Error deleting birthday:", error.message);
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

        const queueInfo = await rabbitChannel.checkQueue(BIRTHDAY_QUEUE);
        res.status(200).json({
            success: true,
            queue: BIRTHDAY_QUEUE,
            messageCount: queueInfo.messageCount,
            consumerCount: queueInfo.consumerCount
        });
    } catch (error) {
        console.error("[Birthday] Error checking queue status:", error.message);
        res.status(500).json({ 
            success: false,
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// Graceful shutdown (internal function, not registered as process event)
const gracefulShutdown = async () => {
    console.log("🛑 [Birthday] Shutting down system gracefully...");
    isShuttingDown = true;
    
    try {
        if (rabbitChannel) {
            await rabbitChannel.close();
            console.log("✅ [Birthday] RabbitMQ channel closed");
        }
        if (rabbitConnection) {
            await rabbitConnection.close();
            console.log("✅ [Birthday] RabbitMQ connection closed");
        }
        
        console.log("✅ [Birthday] System connections closed");
    } catch (error) {
        console.error("❌ [Birthday] Error during shutdown:", error.message);
    }
};

// REMOVED: Global process event handlers (should be handled by main server)

// Schedule birthday processing - runs every day at 1:30 PM IST
cron.schedule("30 13 * * *", async () => {
    try {
        console.log("⏰ [Birthday] Scheduled processing started at", new Date().toLocaleString());
        await processTodaysBirthdays();
    } catch (error) {
        console.error("❌ [Birthday] Error in scheduled processing:", error.message);
    }
});

console.log("🎂 [Birthday] Reminder system initializing...");

// Initialize the birthday system
const startBirthdaySystem = async () => {
    try {
        // Initialize RabbitMQ with retry logic
        await initRabbitMQ();
        
        console.log("📅 [Birthday] Reminder system started successfully!");
        console.log("⏰ [Birthday] Processing scheduled for 1:30 PM daily");
        
    } catch (error) {
        console.error("❌ [Birthday] Failed to start system:", error.message);
        throw error; // Let the main server handle this
    }
};

// Export the router and functions
module.exports = {
    router,
    startBirthdaySystem,
    processTodaysBirthdays,
    gracefulShutdown
};

