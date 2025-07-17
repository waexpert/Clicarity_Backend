const amqp = require('amqplib');
require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment-timezone");

let pool;
try {
    pool = require('../database/databaseConnection');
} catch (error) {
    console.error('❌ [Reminder] Failed to import database connection:', error.message);
}

const router = express.Router();

// RabbitMQ connection variables
let rabbitConnection = null;
let rabbitChannel = null;
let isShuttingDown = false;

// Queue names
const REMINDER_QUEUE = 'payment_reminder_notifications';
const OVERDUE_QUEUE = 'payment_overdue_notifications';
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://webhooks.wa.expert/webhook/68762511e3591ae351cfb1f6";

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
                    console.error('❌ [Payment Reminder] RabbitMQ connection error:', err.message);
                }
            });

            rabbitConnection.on('close', () => {
                if (!isShuttingDown) {
                    console.log('⚠️ [Payment Reminder] RabbitMQ connection closed, attempting to reconnect...');
                    setTimeout(() => initRabbitMQ(), 5000);
                }
            });

            // Declare both queues
            await rabbitChannel.assertQueue(REMINDER_QUEUE, { durable: true });
            await rabbitChannel.assertQueue(OVERDUE_QUEUE, { durable: true });

            console.log("✅ [Payment Reminder] RabbitMQ connected and queues declared");

            // Start consuming messages from both queues
            consumeReminderQueue();
            consumeOverdueQueue();
            return;

        } catch (error) {
            console.log(`❌ [Payment Reminder] Connection attempt ${i + 1} failed:`, error.message);

            if (i === retries - 1) {
                console.error("❌ [Payment Reminder] Failed to connect to RabbitMQ after all retries");
                throw error;
            }

            console.log(`⏳ [Reminder] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Get due reminders (existing functionality)
const getDueReminders = async () => {
    try {
        if (!pool) {
            throw new Error('Database connection not available');
        }

        const currentDate = moment().format('YYYY-MM-DD');
        console.log(`⏰ [Reminder] Checking for reminders on: ${currentDate}`);

        const query = `
            SELECT 
                id, from_company, send_to_company, send_to_phone, due_date,
                status, send_to_name, amount, type, date, invoice_url,
                payment_method, us_id, owner_id
            FROM payment_reminders 
            WHERE date = $1 
            AND status = 'pending'
            AND type IN ('duplicate', 'original')
            ORDER BY date ASC
        `;

        const { rows } = await pool.query(query, [currentDate]);
        console.log(`📝 [Reminder] Found ${rows.length} due reminders`);
        return rows;

    } catch (error) {
        console.error("❌ [Reminder] Error fetching due reminders:", error.message);
        return [];
    }
};

// Get overdue reminders (new functionality)
const getOverdueReminders = async () => {
    try {
        if (!pool) {
            throw new Error('Database connection not available');
        }

        const currentDate = moment().format('YYYY-MM-DD');
        console.log(`⏰ [Overdue] Checking for overdue reminders on: ${currentDate}`);

        // Get records where due_date has passed, type is 'original', and status is 'pending'
        // And either it's the first overdue reminder or 15 days have passed since last overdue reminder
        const query = `
            SELECT 
                id, from_company, send_to_company, send_to_phone, due_date,
                status, send_to_name, amount, type, date, invoice_url,
                payment_method, us_id, owner_id,
                last_overdue_reminder_date
            FROM payment_reminders 
            WHERE due_date < $1 
            AND status = 'pending'
            AND type = 'original'
            AND (
                last_overdue_reminder_date IS NULL 
                OR last_overdue_reminder_date <= $2
            )
            ORDER BY due_date ASC
        `;

        // Calculate 15 days ago for the second condition
        const fifteenDaysAgo = moment().subtract(15, 'days').format('YYYY-MM-DD');

        const { rows } = await pool.query(query, [currentDate, fifteenDaysAgo]);
        console.log(`📝 [Overdue] Found ${rows.length} overdue reminders`);
        return rows;

    } catch (error) {
        console.error("❌ [Overdue] Error fetching overdue reminders:", error.message);
        return [];
    }
};

// Function to send reminder data to RabbitMQ queue
const sendReminderToQueue = async (reminderData, queueName = REMINDER_QUEUE) => {
    try {
        if (!rabbitChannel) {
            console.error("❌ [Reminder] RabbitMQ channel not available");
            return false;
        }

        const message = {
            id: reminderData.id,
            from_company: reminderData.from_company,
            send_to_company: reminderData.send_to_company,
            send_to_phone: reminderData.send_to_phone,
            due_date: reminderData.due_date,
            send_to_name: reminderData.send_to_name,
            amount: reminderData.amount,
            type: reminderData.type,
            invoice_url: reminderData.invoice_url,
            payment_method: reminderData.payment_method,
            us_id: reminderData.us_id,
            owner_id: reminderData.owner_id,
            final_message: `Hi ${reminderData.send_to_name},\n\nThis is a payment reminder for invoice from ${reminderData.from_company}.\nAmount: ${reminderData.amount}\nDue Date: ${reminderData.due_date}\nPayment Method: ${reminderData.payment_method}\n\nPlease make the payment at your earliest convenience.\n\nRegards,\n${reminderData.from_company}`,
            timestamp: new Date().toISOString()
        };

        await rabbitChannel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );

        console.log(`📤 [Reminder] Sent to queue ${queueName}: Invoice ${reminderData.us_id}`);
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
                    console.log(`📥 [Reminder] Processing from queue: Invoice ${reminderData.us_id}`);

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

        console.log("🔄 [Reminder] Regular reminder queue consumer started");

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

// Consumer for overdue reminders queue
const consumeOverdueQueue = async () => {
    try {
        if (!rabbitChannel) {
            console.error("❌ [Overdue] RabbitMQ channel not available for consuming");
            return;
        }

        await rabbitChannel.consume(OVERDUE_QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const reminderData = JSON.parse(msg.content.toString());
                    console.log(`📥 [Overdue] Processing from queue: Invoice ${reminderData.us_id}`);

                    // Update status first to prevent race conditions
                    await updateReminderStatus(reminderData.id, 'processing');

                    // Send to webhook
                    await sendOverdueReminderToWebhook(reminderData);

                    // Update reminder status to 'sent' and update last_overdue_reminder_date
                    await updateOverdueReminderStatus(reminderData.id, 'sent');

                    // Acknowledge the message
                    rabbitChannel.ack(msg);

                } catch (error) {
                    console.error("❌ [Overdue] Error processing message:", error.message);

                    // Reset status on failure
                    try {
                        const reminderData = JSON.parse(msg.content.toString());
                        await updateReminderStatus(reminderData.id, 'failed');
                    } catch (parseError) {
                        console.error("❌ [Overdue] Could not parse message for status update:", parseError.message);
                    }

                    // Reject and requeue the message
                    rabbitChannel.nack(msg, false, true);
                }
            }
        });

        console.log("🔄 [Overdue] Overdue reminder queue consumer started");

    } catch (error) {
        console.error("❌ [Overdue] Error setting up overdue queue consumer:", error.message);

        // Retry consumer setup after delay
        if (!isShuttingDown) {
            setTimeout(() => {
                console.log("🔄 [Overdue] Retrying overdue consumer setup...");
                consumeOverdueQueue();
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
            "UPDATE payment_reminders SET status = $1, sent_at = $2 WHERE id = $3 RETURNING id",
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

// Update overdue reminder status with last_overdue_reminder_date
const updateOverdueReminderStatus = async (reminderId, status) => {
    try {
        if (!pool) {
            console.error('❌ [Overdue] Database connection not available for status update');
            return false;
        }

        const currentDate = moment().format('YYYY-MM-DD');
        const result = await pool.query(
            "UPDATE payment_reminders SET status = $1, sent_at = $2, last_overdue_reminder_date = $3 WHERE id = $4 RETURNING id",
            [status, new Date(), currentDate, reminderId]
        );

        if (result.rowCount === 0) {
            console.warn(`⚠️ [Overdue] No reminder found with ID: ${reminderId}`);
            return false;
        }

        console.log(`✅ [Overdue] Status updated to '${status}' and last_overdue_reminder_date set for ID: ${reminderId}`);
        return true;
    } catch (error) {
        console.error(`❌ [Overdue] Error updating status:`, error.message);
        return false;
    }
};

// Function to send reminder to webhook
const sendReminderToWebhook = async (reminderData) => {
    try {
        const encodedMessage = encodeURIComponent(reminderData.final_message);
        const whatsappLink = `https://wa.me/${reminderData.send_to_phone}?text=${encodedMessage}`;

        const payload = {
            id: reminderData.id,
            from_company: reminderData.from_company,
            send_to_company: reminderData.send_to_company,
            send_to_phone: reminderData.send_to_phone,
            due_date: reminderData.due_date,
            send_to_name: reminderData.send_to_name,
            amount: reminderData.amount,
            type: reminderData.type,
            invoice_url: reminderData.invoice_url,
            payment_method: reminderData.payment_method,
            us_id: reminderData.us_id,
            owner_id: reminderData.owner_id,
            final_message: reminderData.final_message,
            whatsapp_link: whatsappLink,
            timestamp: reminderData.timestamp,
            reminder_type: 'payment_reminder'
        };

        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                "Content-Type": "application/json"
            },
            timeout: 10000
        });

        console.log(`✅ [Reminder] Sent to webhook: Invoice ${reminderData.us_id}`);
        console.log(`🔗 [Reminder] Webhook Response Status: ${response.status}`);

    } catch (error) {
        console.error(`❌ [Reminder] Error sending webhook for Invoice ${reminderData.us_id}:`,
            error.response ? error.response.data : error.message);
        throw error; // Re-throw to handle in queue consumer
    }
};

// Function to send overdue reminder to webhook
const sendOverdueReminderToWebhook = async (reminderData) => {
    try {
        const overdueMessage = `Hi ${reminderData.send_to_name},\n\nThis is an OVERDUE payment reminder for invoice from ${reminderData.from_company}.\nAmount: ${reminderData.amount}\nDue Date: ${reminderData.due_date} (OVERDUE)\nPayment Method: ${reminderData.payment_method}\n\nThis payment is now overdue. Please make the payment immediately to avoid any inconvenience.\n\nRegards,\n${reminderData.from_company}`;
        
        const encodedMessage = encodeURIComponent(overdueMessage);
        const whatsappLink = `https://wa.me/${reminderData.send_to_phone}?text=${encodedMessage}`;

        const payload = {
            id: reminderData.id,
            from_company: reminderData.from_company,
            send_to_company: reminderData.send_to_company,
            send_to_phone: reminderData.send_to_phone,
            due_date: reminderData.due_date,
            send_to_name: reminderData.send_to_name,
            amount: reminderData.amount,
            type: reminderData.type,
            invoice_url: reminderData.invoice_url,
            payment_method: reminderData.payment_method,
            us_id: reminderData.us_id,
            owner_id: reminderData.owner_id,
            final_message: overdueMessage,
            whatsapp_link: whatsappLink,
            timestamp: new Date().toISOString(),
            reminder_type: 'overdue_reminder'
        };

        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                "Content-Type": "application/json"
            },
            timeout: 10000
        });

        console.log(`✅ [Overdue] Sent to webhook: Invoice ${reminderData.us_id}`);
        console.log(`🔗 [Overdue] Webhook Response Status: ${response.status}`);

    } catch (error) {
        console.error(`❌ [Overdue] Error sending webhook for Invoice ${reminderData.us_id}:`,
            error.response ? error.response.data : error.message);
        throw error; // Re-throw to handle in queue consumer
    }
};

// Enhanced reminder processing
const processDueReminders = async () => {
    try {
        console.log("⏰ [Reminder] Starting regular reminder processing...");

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
                const success = await sendReminderToQueue(reminder, REMINDER_QUEUE);
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

        console.log(`⏰ [Reminder] Regular processing completed: ${successCount} sent, ${errorCount} failed`);

    } catch (error) {
        console.error("❌ [Reminder] Error processing reminders:", error.message);
    }
};

// Process overdue reminders
const processOverdueReminders = async () => {
    try {
        console.log("⏰ [Overdue] Starting overdue reminder processing...");

        const reminders = await getOverdueReminders();

        if (reminders.length === 0) {
            console.log("😔 [Overdue] No overdue reminders found");
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        // Send each overdue reminder to the queue
        for (const reminder of reminders) {
            try {
                const success = await sendReminderToQueue(reminder, OVERDUE_QUEUE);
                if (success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                console.error(`❌ [Overdue] Error processing overdue reminder ${reminder.id}:`, error.message);
                errorCount++;
            }

            // Small delay to prevent overwhelming the queue
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`⏰ [Overdue] Overdue processing completed: ${successCount} sent, ${errorCount} failed`);

    } catch (error) {
        console.error("❌ [Overdue] Error processing overdue reminders:", error.message);
    }
};

// Route: Add a new payment reminder with multiple reminders
router.post("/add", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                success: false,
                error: "Database connection not available"
            });
        }

        const {
            from_company,
            send_to_company,
            send_to_phone,
            due_date,
            status = 'pending',
            send_to_name,
            amount,
            type,
            date,
            invoice_url,
            payment_method,
            us_id,
            owner_id,
            number_of_reminders = 1,
            days_diff = [0]
        } = req.body;

        // Validate required fields
        const requiredFields = ['from_company', 'send_to_company', 'send_to_phone', 'due_date', 
            'send_to_name', 'amount', 'invoice_url', 'payment_method', 'us_id', 'owner_id'];
        const missingFields = requiredFields.filter(field => !req.body[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
                missing: missingFields
            });
        }

        // Validate arrays length match
        if (days_diff.length !== number_of_reminders) {
            return res.status(400).json({
                success: false,
                error: "days_diff array length must match number_of_reminders"
            });
        }

        // Validate due_date format
        if (!moment(due_date, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).json({
                success: false,
                error: "Invalid due_date format. Use YYYY-MM-DD"
            });
        }

        const dueDateMoment = moment(due_date);
        const insertedRecords = [];

        // Create multiple reminder records
        for (let i = 0; i < number_of_reminders; i++) {
            // Calculate reminder date: due_date - days_diff[i]
            const reminderDate = dueDateMoment.clone().subtract(days_diff[i], 'days').format('YYYY-MM-DD');
            
            // Determine type: first record is 'original', others are 'duplicate'
            const recordType = i === 0 ? 'original' : 'duplicate';

            const result = await pool.query(
                `INSERT INTO payment_reminders 
                (from_company, send_to_company, send_to_phone, due_date, status, send_to_name, 
                 amount, type, date, invoice_url, payment_method, us_id, owner_id) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
                RETURNING id`,
                [from_company, send_to_company, send_to_phone, due_date, status, send_to_name, 
                 amount, recordType, reminderDate, invoice_url, payment_method, us_id, owner_id]
            );

            insertedRecords.push({
                id: result.rows[0].id,
                type: recordType,
                reminder_date: reminderDate,
                days_before_due: days_diff[i]
            });

            console.log(`✅ [Reminder] Created ${recordType} reminder for ${us_id} on ${reminderDate} (${days_diff[i]} days before due)`);
        }

        res.status(201).json({
            success: true,
            message: "Payment reminders created successfully",
            us_id: us_id,
            total_reminders: number_of_reminders,
            records: insertedRecords
        });

    } catch (error) {
        console.error("[Reminder] Error adding payment reminders:", error.message);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
            message: error.message
        });
    }
});

// Route: Mark payment as paid
router.patch("/mark-paid/:us_id", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                success: false,
                error: "Database connection not available"
            });
        }

        const { us_id } = req.params;
        const paidDate = new Date().toISOString();

        // Update all records (both original and duplicate) with the given us_id to 'paid' status
        const result = await pool.query(
            `UPDATE payment_reminders 
             SET status = 'paid', sent_at = $1 
             WHERE us_id = $2 AND status != 'paid'
             RETURNING id, type`,
            [paidDate, us_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: "No pending reminders found for this us_id"
            });
        }

        console.log(`✅ [Payment] Marked ${result.rowCount} reminders as paid for us_id: ${us_id}`);

        res.status(200).json({
            success: true,
            message: "Payment marked as paid successfully",
            us_id: us_id,
            updated_records: result.rowCount,
            updated_reminders: result.rows
        });

    } catch (error) {
        console.error("[Payment] Error marking payment as paid:", error.message);
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

        const { rows } = await pool.query("SELECT * FROM payment_reminders ORDER BY due_date, date");
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

// Route: Get reminders by us_id
router.get("/by-invoice/:us_id", async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({
                success: false,
                error: "Database connection not available"
            });
        }

        const { us_id } = req.params;
        const { rows } = await pool.query(
            "SELECT * FROM payment_reminders WHERE us_id = $1 ORDER BY date",
            [us_id]
        );
        
        res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error("[Reminder] Error fetching reminders by us_id:", error.message);
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
            "SELECT * FROM payment_reminders WHERE date = $1 ORDER BY due_date",
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
            "SELECT * FROM payment_reminders WHERE status = 'pending' ORDER BY due_date, date"
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

// Route: Manually trigger overdue processing
router.post("/process-overdue", async (req, res) => {
    try {
        await processOverdueReminders();
        res.status(200).json({
            success: true,
            message: "Overdue reminder processing initiated successfully",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Overdue] Error in manual processing:", error.message);
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

        const reminderQueueInfo = await rabbitChannel.checkQueue(REMINDER_QUEUE);
        const overdueQueueInfo = await rabbitChannel.checkQueue(OVERDUE_QUEUE);
        
        res.status(200).json({
            success: true,
            queues: {
                reminder_queue: {
                    name: REMINDER_QUEUE,
                    messageCount: reminderQueueInfo.messageCount,
                    consumerCount: reminderQueueInfo.consumerCount
                },
                overdue_queue: {
                    name: OVERDUE_QUEUE,
                    messageCount: overdueQueueInfo.messageCount,
                    consumerCount: overdueQueueInfo.consumerCount
                }
            }
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

// Graceful shutdown
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

// Schedule regular reminder processing - runs every 30 minutes
cron.schedule("*/30 * * * *", async () => {
    try {
        console.log("⏰ [Reminder] Scheduled regular processing started at", new Date().toLocaleString());
        await processDueReminders();
    } catch (error) {
        console.error("❌ [Reminder] Error in scheduled processing:", error.message);
    }
});

// Schedule overdue reminder processing - runs daily at 4:00 AM
cron.schedule("0 4 * * *", async () => {
    try {
        console.log("⏰ [Overdue] Scheduled overdue processing started at", new Date().toLocaleString());
        await processOverdueReminders();
    } catch (error) {
        console.error("❌ [Overdue] Error in scheduled overdue processing:", error.message);
    }
});

console.log("⏰ [Reminder] Payment reminder system initializing...");

// Initialize the reminder system
const startReminderSystem = async () => {
    try {
        // Initialize RabbitMQ with retry logic
        await initRabbitMQ();

        console.log("📅 [Reminder] Payment reminder system started successfully!");
        console.log("⏰ [Reminder] Regular processing scheduled every 30 minutes");
        console.log("⏰ [Overdue] Overdue processing scheduled daily at 4:00 AM");

    } catch (error) {
        console.error("❌ [Reminder] Failed to start system:", error.message);
        throw error;
    }
};

// Export the router and functions
module.exports = {
    router,
    startReminderSystem,
    processDueReminders,
    processOverdueReminders,
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
            console.log('🚀 [Reminder] Payment reminder system running on port 3001');
        });
    }).catch(error => {
        console.error('[Reminder] Failed to start system:', error);
        process.exit(1);
    });
}