// const amqp = require('amqplib');
// require("dotenv").config();
// const express = require("express");
// const bodyParser = require("body-parser");
// const { Pool } = require("pg");
// const cron = require("node-cron");
// const axios = require("axios");
// const moment = require("moment-timezone");
// const pool = require('../database/databaseConnection');

// const app = express();
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());

// let apiCallCount = 0;

// app.use((req, res, next) => {
//     apiCallCount++;
//     console.log(`Total API Calls: ${apiCallCount}`);
//     next();
// });

// // RabbitMQ connection variables
// let rabbitConnection = null;
// let rabbitChannel = null;

// const BIRTHDAY_QUEUE = 'birthday_reminders';
// const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://webhooks.wa.expert/webhook/67ebdd419a714c7c4697f64d";

// // Initialize RabbitMQ connection with retry logic
// const initRabbitMQ = async (retries = 5, delay = 2000) => {
//     for (let i = 0; i < retries; i++) {
//         try {
//             console.log(`🔄 Attempting RabbitMQ connection (attempt ${i + 1}/${retries})...`);
            
//             rabbitConnection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
//             rabbitChannel = await rabbitConnection.createChannel();
            
//             // Declare the birthday queue
//             await rabbitChannel.assertQueue(BIRTHDAY_QUEUE, { durable: true });
            
//             console.log("✅ RabbitMQ connected and queue declared");
            
//             // Start consuming messages from the queue
//             consumeBirthdayQueue();
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

// // Function to get today's birthdays from database
// const getTodaysBirthdays = async () => {
//     try {
//         // Get today's date in MM-DD format for birthday comparison
//         const today = moment().format('MM-DD');
        
//         console.log(`🎂 Checking for birthdays on: ${today}`);
//         const query = `
//             SELECT 
//                 id,
//                 name as receiver_name,
//                 phone as receiver_number,
//                 sender_name,
//                 sender_phone as send_to_number,
//                 birthday_date,
//                 special_day,
//                 EXTRACT(YEAR FROM AGE(birthday_date)) + 1 as age
//             FROM birthdays 
//             WHERE TO_CHAR(birthday_date, 'MM-DD') = $1
//         `;
        
//         const { rows } = await pool.query(query, [today]);
        
//         console.log(`🎉 Found ${rows.length} birthdays for today`);
//         return rows;
        
//     } catch (error) {
//         console.error("❌ Error fetching today's birthdays:", error);
//         return [];
//     }
// };

// // Function to send birthday data to RabbitMQ queue
// const sendBirthdayToQueue = async (birthdayData) => {
//     try {
//         if (!rabbitChannel) {
//             console.error("❌ RabbitMQ channel not available");
//             return false;
//         }

//         const message = {
//             receiver_name: birthdayData.receiver_name,
//             receiver_number: birthdayData.receiver_number,
//             sender_name: birthdayData.sender_name,
//             send_to_number: birthdayData.send_to_number,
//             birthday_date: birthdayData.birthday_date,
//             age: birthdayData.age,
//             special_day: birthdayData.special_day,
//             message: `🎉 Happy ${birthdayData.special_day} ${birthdayData.receiver_name}! Wishing you a wonderful ${birthdayData.age}th ${birthdayData.special_day}! 🎂`,
//             timestamp: new Date().toISOString()
//         };

//         await rabbitChannel.sendToQueue(
//             BIRTHDAY_QUEUE, 
//             Buffer.from(JSON.stringify(message)),
//             { persistent: true }
//         );

//         console.log(`📤 Birthday reminder sent to queue for: ${birthdayData.receiver_name}`);
//         return true;

//     } catch (error) {
//         console.error("❌ Error sending birthday to queue:", error);
//         return false;
//     }
// };

// // Function to consume messages from birthday queue and send to webhook
// const consumeBirthdayQueue = async () => {
//     try {
//         if (!rabbitChannel) {
//             console.error("❌ RabbitMQ channel not available for consuming");
//             return;
//         }

//         await rabbitChannel.consume(BIRTHDAY_QUEUE, async (msg) => {
//             if (msg !== null) {
//                 try {
//                     const birthdayData = JSON.parse(msg.content.toString());
//                     console.log(`📥 Processing birthday reminder from queue: ${birthdayData.receiver_name}`);
                    
//                     // Send to webhook
//                     await sendBirthdayToWebhook(birthdayData);
                    
//                     // Acknowledge the message
//                     rabbitChannel.ack(msg);
                    
//                 } catch (error) {
//                     console.error("❌ Error processing birthday message:", error);
//                     // Reject and requeue the message
//                     rabbitChannel.nack(msg, false, true);
//                 }
//             }
//         });

//         console.log("🔄 Birthday queue consumer started");

//     } catch (error) {
//         console.error("❌ Error setting up queue consumer:", error);
//     }
// };

// // Function to send birthday reminder to webhook
// const sendBirthdayToWebhook = async (birthdayData) => {
//     try {
//         const encodedMessage = encodeURIComponent(birthdayData.message);
//         const finalMessage = `https://wa.me/${birthdayData.send_to_number}?text=${encodedMessage}`;

//         const payload = {
//             receiver_name: birthdayData.receiver_name,
//             receiver_number: birthdayData.receiver_number,
//             sender_name: birthdayData.sender_name,
//             send_to_number: birthdayData.send_to_number,
//             message: birthdayData.message,
//             final_message: finalMessage,
//             birthday_date: birthdayData.birthday_date,
//             age: birthdayData.age,
//             special_day: birthdayData.special_day,
//             timestamp: birthdayData.timestamp
//         };

//         const response = await axios.post(WEBHOOK_URL, payload, {
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             timeout: 10000 // 10 second timeout
//         });

//         console.log(`✅ Birthday reminder sent to webhook for: ${birthdayData.receiver_name}`);
//         console.log("🔗 Webhook Response Status:", response.status);

//     } catch (error) {
//         console.error(`❌ Error sending birthday webhook for ${birthdayData.receiver_name}:`, 
//             error.response ? error.response.data : error.message);
//         throw error; // Re-throw to handle in queue consumer
//     }
// };

// // Main function to process today's birthdays
// const processTodaysBirthdays = async () => {
//     try {
//         console.log("🎂 Starting birthday processing...");
        
//         const birthdays = await getTodaysBirthdays();
        
//         if (birthdays.length === 0) {
//             console.log("😔 No birthdays found for today");
//             return;
//         }

//         let successCount = 0;
//         let errorCount = 0;

//         // Send each birthday to the queue
//         for (const birthday of birthdays) {
//             const success = await sendBirthdayToQueue(birthday);
//             if (success) {
//                 successCount++;
//             } else {
//                 errorCount++;
//             }
            
//             // Small delay to prevent overwhelming the queue
//             await new Promise(resolve => setTimeout(resolve, 100));
//         }

//         console.log(`🎉 Birthday processing completed: ${successCount} sent, ${errorCount} failed`);

//     } catch (error) {
//         console.error("❌ Error processing birthdays:", error);
//     }
// };

// // API endpoint to manually trigger birthday processing
// app.post("/process", async (req, res) => {
//     try {
//         await processTodaysBirthdays();
//         res.status(200).json({ 
//             message: "Birthday processing initiated successfully",
//             timestamp: new Date().toISOString()
//         });
//     } catch (error) {
//         console.error("Error in manual birthday processing:", error);
//         res.status(500).json({ 
//             error: "Internal Server Error", 
//             message: error.message 
//         });
//     }
// });

// // API endpoint to add a new birthday
// app.post("/add", async (req, res) => {
//     try {
//         const { name, phone, birthday_date, sender_name, sender_phone, special_day } = req.body;
        
//         if (!name || !phone || !birthday_date || !sender_name || !sender_phone) {
//             return res.status(400).json({ error: "All fields are required" });
//         }

//         // Validate date format
//         if (!moment(birthday_date, 'YYYY-MM-DD', true).isValid()) {
//             return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
//         }

//         await pool.query(
//             "INSERT INTO birthdays (name, phone, birthday_date, sender_name, sender_phone, special_day) VALUES ($1, $2, $3, $4, $5, $6)",
//             [name, phone, birthday_date, sender_name, sender_phone, special_day]
//         );

//         res.status(201).json({ message: "Birthday added successfully" });
//     } catch (error) {
//         console.error("Error adding birthday:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // API endpoint to get all birthdays
// app.get("/list", async (req, res) => {
//     try {
//         const { rows } = await pool.query("SELECT * FROM birthdays ORDER BY birthday_date");
//         res.status(200).json(rows);
//     } catch (error) {
//         console.error("Error fetching birthdays:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // API endpoint to get today's birthdays
// app.get("/today", async (req, res) => {
//     try {
//         const birthdays = await getTodaysBirthdays();
//         res.status(200).json(birthdays);
//     } catch (error) {
//         console.error("Error fetching today's birthdays:", error);
//         res.status(500).json({ error: "Internal Server Error", message: error.message });
//     }
// });

// // API endpoint to get queue status
// app.get("/queue/status", async (req, res) => {
//     try {
//         if (!rabbitChannel) {
//             return res.status(503).json({ error: "RabbitMQ not connected" });
//         }

//         const queueInfo = await rabbitChannel.checkQueue(BIRTHDAY_QUEUE);
//         res.status(200).json({
//             queue: BIRTHDAY_QUEUE,
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

// // Schedule birthday processing - runs every day at 1:00 PM IST
// cron.schedule("30 1 * * *", () => {
//     console.log("⏰ Scheduled birthday processing started at", new Date().toLocaleString());
//     processTodaysBirthdays();
// });

// // Optional: For testing - uncomment to run every hour
// // cron.schedule("0 * * * *", processTodaysBirthdays);

// console.log("🎂 Birthday reminder system starting...");

// // Initialize the application
// const startApplication = async () => {
//     try {
//         // Initialize RabbitMQ with retry logic
//         await initRabbitMQ();
        
//         // Start the Express server
//         app.listen(process.env.PORT || 3000, () => {
//             console.log(`🚀 Server running at http://localhost:${process.env.PORT || 3000}`);
//             console.log("📅 Birthday reminder system started successfully!");
//             console.log("⏰ Birthday processing scheduled for 1:00PM daily");
            
//             // REMOVED: Automatic birthday processing on startup
//             // This was causing immediate execution instead of waiting for scheduled time
//         });
        
//     } catch (error) {
//         console.error("❌ Failed to start application:", error);
//         process.exit(1);
//     }
// };

// startApplication();


const amqp = require('amqplib');
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
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
let isShuttingDown = false;

const BIRTHDAY_QUEUE = 'birthday_reminders';
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://webhooks.wa.expert/webhook/67ebdd419a714c7c4697f64d";

// Initialize RabbitMQ connection with retry logic
const initRabbitMQ = async (retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`🔄 Attempting RabbitMQ connection (attempt ${i + 1}/${retries})...`);
            
            rabbitConnection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
            rabbitChannel = await rabbitConnection.createChannel();
            
            // Add connection error handlers
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
            
            // Declare the birthday queue
            await rabbitChannel.assertQueue(BIRTHDAY_QUEUE, { durable: true });
            
            console.log("✅ RabbitMQ connected and queue declared");
            
            // Start consuming messages from the queue
            consumeBirthdayQueue();
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

// Function to get today's birthdays from database
const getTodaysBirthdays = async () => {
    try {
        // Get today's date in MM-DD format for birthday comparison
        const today = moment().format('MM-DD');
        
        console.log(`🎂 Checking for birthdays on: ${today}`);
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
        
        console.log(`🎉 Found ${rows.length} birthdays for today`);
        return rows;
        
    } catch (error) {
        console.error("❌ Error fetching today's birthdays:", error);
        return [];
    }
};

// Function to send birthday data to RabbitMQ queue
const sendBirthdayToQueue = async (birthdayData) => {
    try {
        if (!rabbitChannel) {
            console.error("❌ RabbitMQ channel not available");
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

        console.log(`📤 Birthday reminder sent to queue for: ${birthdayData.receiver_name}`);
        return true;

    } catch (error) {
        console.error("❌ Error sending birthday to queue:", error);
        return false;
    }
};

// Function to consume messages from birthday queue and send to webhook
const consumeBirthdayQueue = async () => {
    try {
        if (!rabbitChannel) {
            console.error("❌ RabbitMQ channel not available for consuming");
            return;
        }

        await rabbitChannel.consume(BIRTHDAY_QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const birthdayData = JSON.parse(msg.content.toString());
                    console.log(`📥 Processing birthday reminder from queue: ${birthdayData.receiver_name}`);
                    
                    // Send to webhook
                    await sendBirthdayToWebhook(birthdayData);
                    
                    // Acknowledge the message
                    rabbitChannel.ack(msg);
                    
                } catch (error) {
                    console.error("❌ Error processing birthday message:", error);
                    // Reject and requeue the message
                    rabbitChannel.nack(msg, false, true);
                }
            }
        });

        console.log("🔄 Birthday queue consumer started");

    } catch (error) {
        console.error("❌ Error setting up queue consumer:", error);
        
        // Retry consumer setup after delay
        if (!isShuttingDown) {
            setTimeout(() => {
                console.log("🔄 Retrying birthday consumer setup...");
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

        console.log(`✅ Birthday reminder sent to webhook for: ${birthdayData.receiver_name}`);
        console.log("🔗 Webhook Response Status:", response.status);

    } catch (error) {
        console.error(`❌ Error sending birthday webhook for ${birthdayData.receiver_name}:`, 
            error.response ? error.response.data : error.message);
        throw error; // Re-throw to handle in queue consumer
    }
};

// Main function to process today's birthdays
const processTodaysBirthdays = async () => {
    try {
        console.log("🎂 Starting birthday processing...");
        
        const birthdays = await getTodaysBirthdays();
        
        if (birthdays.length === 0) {
            console.log("😔 No birthdays found for today");
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
                console.error(`❌ Error processing birthday ${birthday.id}:`, error);
                errorCount++;
            }
            
            // Small delay to prevent overwhelming the queue
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`🎉 Birthday processing completed: ${successCount} sent, ${errorCount} failed`);

    } catch (error) {
        console.error("❌ Error processing birthdays:", error);
    }
};

// API endpoint to manually trigger birthday processing
router.post("/process", async (req, res) => {
    try {
        await processTodaysBirthdays();
        res.status(200).json({ 
            message: "Birthday processing initiated successfully",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error in manual birthday processing:", error);
        res.status(500).json({ 
            error: "Internal Server Error", 
            message: error.message 
        });
    }
});

// API endpoint to add a new birthday
router.post("/add", async (req, res) => {
    try {
        const { name, phone, birthday_date, sender_name, sender_phone, special_day } = req.body;
        
        if (!name || !phone || !birthday_date || !sender_name || !sender_phone) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Validate date format
        if (!moment(birthday_date, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }

        await pool.query(
            "INSERT INTO birthdays (name, phone, birthday_date, sender_name, sender_phone, special_day) VALUES ($1, $2, $3, $4, $5, $6)",
            [name, phone, birthday_date, sender_name, sender_phone, special_day]
        );

        res.status(201).json({ message: "Birthday added successfully" });
    } catch (error) {
        console.error("Error adding birthday:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to get all birthdays
router.get("/list", async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM birthdays ORDER BY birthday_date");
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching birthdays:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to get today's birthdays
router.get("/today", async (req, res) => {
    try {
        const birthdays = await getTodaysBirthdays();
        res.status(200).json(birthdays);
    } catch (error) {
        console.error("Error fetching today's birthdays:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to get upcoming birthdays (next 30 days)
router.get("/upcoming", async (req, res) => {
    try {
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
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching upcoming birthdays:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to update a birthday
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, birthday_date, sender_name, sender_phone, special_day } = req.body;
        
        if (!name || !phone || !birthday_date || !sender_name || !sender_phone) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Validate date format
        if (!moment(birthday_date, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
        }

        const result = await pool.query(
            "UPDATE birthdays SET name = $1, phone = $2, birthday_date = $3, sender_name = $4, sender_phone = $5, special_day = $6 WHERE id = $7 RETURNING id",
            [name, phone, birthday_date, sender_name, sender_phone, special_day, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Birthday not found" });
        }

        res.status(200).json({ message: "Birthday updated successfully" });
    } catch (error) {
        console.error("Error updating birthday:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to delete a birthday
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM birthdays WHERE id = $1 RETURNING id", [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Birthday not found" });
        }
        
        res.status(200).json({ message: "Birthday deleted successfully" });
    } catch (error) {
        console.error("Error deleting birthday:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// API endpoint to get queue status
router.get("/queue/status", async (req, res) => {
    try {
        if (!rabbitChannel) {
            return res.status(503).json({ error: "RabbitMQ not connected" });
        }

        const queueInfo = await rabbitChannel.checkQueue(BIRTHDAY_QUEUE);
        res.status(200).json({
            queue: BIRTHDAY_QUEUE,
            messageCount: queueInfo.messageCount,
            consumerCount: queueInfo.consumerCount
        });
    } catch (error) {
        console.error("Error checking queue status:", error);
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log("🛑 Shutting down birthday system gracefully...");
    isShuttingDown = true;
    
    try {
        // Stop accepting new connections first
        if (rabbitChannel) {
            await rabbitChannel.close();
            console.log("✅ Birthday RabbitMQ channel closed");
        }
        if (rabbitConnection) {
            await rabbitConnection.close();
            console.log("✅ Birthday RabbitMQ connection closed");
        }
        
        // Wait a bit for ongoing operations to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log("✅ Birthday system connections closed");
    } catch (error) {
        console.error("❌ Error during birthday system shutdown:", error);
    }
};

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Schedule birthday processing - runs every day at 1:30 PM IST
cron.schedule("30 13 * * *", async () => {
    try {
        console.log("⏰ Scheduled birthday processing started at", new Date().toLocaleString());
        await processTodaysBirthdays();
    } catch (error) {
        console.error("❌ Error in scheduled birthday processing:", error);
    }
});

console.log("🎂 Birthday reminder system starting...");

// Initialize the birthday system
const startBirthdaySystem = async () => {
    try {
        // Initialize RabbitMQ with retry logic
        await initRabbitMQ();
        
        console.log("📅 Birthday reminder system started successfully!");
        console.log("⏰ Birthday processing scheduled for 1:30 PM daily");
        
    } catch (error) {
        console.error("❌ Failed to start birthday system:", error);
        throw error; // Let the main server handle this
    }
};

// Export the router and start function
module.exports = {
    router,
    startBirthdaySystem,
    processTodaysBirthdays, // Export for manual use
    gracefulShutdown
};

// Auto-start if this file is run directly
if (require.main === module) {
    const express = require('express');
    const app = express();
    
    app.use('/birthday', router);
    
    startBirthdaySystem().then(() => {
        app.listen(3000, () => {
            console.log('🚀 Birthday system running on port 3000');
        });
    }).catch(error => {
        console.error('Failed to start birthday system:', error);
        process.exit(1);
    });
}