
const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment-timezone");
const amqp = require("amqplib");
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let channel; // RabbitMQ channel
const QUEUE_NAME = 'task_reminder_queue';

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Connect to RabbitMQ
async function connectRabbitMQ() {
  try {
    // Connect to RabbitMQ server
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    console.log('🐰 Connected to RabbitMQ');
    
    // Create a channel
    channel = await connection.createChannel();
    
    // Make sure queue exists with persistence enabled
    await channel.assertQueue(QUEUE_NAME, { 
      durable: true // Queue survives broker restart
    });
    
    console.log(`🔄 RabbitMQ queue "${QUEUE_NAME}" created/confirmed`);
    
    // Set up consumer for the queue
    await consumeTasks();
  } catch (error) {
    console.error('❌ Error connecting to RabbitMQ:', error);
    // Retry connection after delay
    setTimeout(connectRabbitMQ, 5000);
  }
}

// Function to get today's date in YYYY-MM-DD format
function getTodayDate() {
  return moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
}

// Function to discover all "tasks" tables across all schemas
async function discoverTaskTables() {
  try {
    // Query to find all schemas and their tables named "tasks"
    const query = `
      SELECT 
        n.nspname AS schema_name,
        c.relname AS table_name
      FROM 
        pg_catalog.pg_class c
      JOIN 
        pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE 
        c.relname = 'tasks'
        AND c.relkind = 'r'    -- Only regular tables (r = relation)
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')  -- Exclude system schemas
      ORDER BY 
        schema_name;
    `;
    
    const { rows } = await pool.query(query);
    console.log(`📊 Found ${rows.length} "tasks" tables across different schemas`);
    return rows;
  } catch (error) {
    console.error("❌ Error discovering task tables:", error);
    throw error;
  }
}

// Function to load tasks due today and queue them in RabbitMQ (original function)
const loadTasksDueToday = async () => {
  try {
    const today = getTodayDate();
    console.log(`🕒 Fetching tasks due on ${today}`);

    const { rows } = await pool.query(
      `SELECT * FROM danger.tasks WHERE due_date::date = $1 AND processed = false`,
      [today]
    );
    
    console.log(`✅ Found ${rows.length} tasks due today to queue`);
    
    // Queue each task in RabbitMQ
    for (const task of rows) {
      await queueTask(task);
      
      // Mark as processed in database
      await pool.query(
        "UPDATE danger.tasks SET processed = true WHERE id = $1",
        [task.id]
      );
    }
  } catch (error) {
    console.error("❌ Error loading tasks due today:", error);
  }
};

// Function to load all tasks due today from all discovered tables
async function loadAllTasksDueToday() {
  try {
    const today = getTodayDate();
    console.log(`🕒 Fetching tasks due on ${today} from all schemas`);
    
    // Discover all tasks tables
    const taskTables = await discoverTaskTables();
    let totalTasksQueued = 0;
    
    // Process each discovered table
    for (const tableInfo of taskTables) {
      const { schema_name, table_name } = tableInfo;
      
      console.log(`🔍 Checking ${schema_name}.${table_name} for due tasks`);
      
      // Query for tasks due today
      const query = `SELECT * FROM "${schema_name}"."${table_name}" WHERE due_date::date = $1 AND processed = false`;
      const { rows: tasks } = await pool.query(query, [today]);
      
      console.log(`✅ Found ${tasks.length} tasks due today in ${schema_name}.${table_name}`);
      
      // Queue each task with schema information
      for (const task of tasks) {
        // Add schema and table info to the task
        const enrichedTask = {
          ...task,
          schema_name,
          table_name
        };
        
        await queueTask(enrichedTask);
        
        // Mark as processed in database
        await pool.query(
          `UPDATE "${schema_name}"."${table_name}" SET processed = true WHERE id = $1`,
          [task.id]
        );
        
        totalTasksQueued++;
      }
    }
    
    console.log(`🎉 Total tasks queued across all schemas: ${totalTasksQueued}`);
    return totalTasksQueued;
  } catch (error) {
    console.error("❌ Error loading tasks due today from all schemas:", error);
    throw error;
  }
}

// Function to queue a task in RabbitMQ
const queueTask = async (task) => {
  try {
    if (!channel) {
      console.error("❌ RabbitMQ channel not established");
      return;
    }
    
    // Add message to queue
    const message = {
      ...task,
      enqueuedAt: new Date().getTime()
    };
    
    // Send to main queue
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), { 
      persistent: true
    });
    
    console.log(`⚡ Queued task "${task.task_name}" for processing`);
  } catch (error) {
    console.error("❌ Error queuing task:", error);
  }
};

// Function to consume tasks from RabbitMQ queue
const consumeTasks = async () => {
  try {
    // Set up consumer with manual acknowledgment
    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;
      
      try {
        const task = JSON.parse(msg.content.toString());
        console.log(`🔔 Processing task: ${task.task_name}`);
        
        // Generate PDF for the task
        const pdfResponse = await generatePdfForTask(task);
        
        // Add PDF URL to task data
        task.pdf_url = pdfResponse;
        
        // Send the task reminder with PDF URL
        await sendTaskToWebhook(task);
        
        // Acknowledge the message (remove from queue)
        channel.ack(msg);
        
        console.log(`✅ Task processed and acknowledged: ${task.task_name}`);
      } catch (error) {
        console.error("❌ Error processing task:", error);
        
        // Negative acknowledgment (requeue)
        channel.nack(msg, false, true);
      }
    }, { noAck: false }); // Manual acknowledgment
    
    console.log("🎧 Task consumer started");
  } catch (error) {
    console.error("❌ Error setting up task consumer:", error);
  }
};

// Function to generate PDF for a task
const generatePdfForTask = async (task) => {
  try {
    // Extract schema and table information from the task
    const schema_name = task.schema_name || 'danger'; // Default to 'danger' for backward compatibility
    const table_name = task.table_name || 'tasks';    // Default to 'tasks' for backward compatibility
    
    // Get all tasks for this assigned person that are not processed
    const { rows } = await pool.query(
      `SELECT * FROM "${schema_name}"."${table_name}" 
       WHERE assigned_to = $1 
       AND processed = false`,
      [task.assigned_to]
    );
    
    console.log(`Found ${rows.length} pending tasks for ${task.assigned_to} in ${schema_name}.${table_name}`);
    
    // Generate PDF by hitting the API with the correct schema and table name
    // UPDATED: Changed the API URL to the new endpoint
    const response = await axios.get(
      `https://click.wa.expert/api/generatePdf?schemaName=${schema_name}&tableName=${table_name}&assignedTo=${task.assigned_to}`
    );
    
    console.log(`📄 PDF generated for ${task.assigned_to} from ${schema_name}.${table_name}: ${response.data.downloadUrl}`);
    
    // ADDED: Shorten the PDF URL
    const shortenedUrl = await shortenUrl(response.data.downloadUrl);
    
    return shortenedUrl;
  } catch (error) {
    console.error("❌ Error generating PDF:", error.response ? error.response.data : error.message);
    throw error;
  }
};

// ADDED: New function to shorten URLs
const shortenUrl = async (url) => {
  try {
    // Ensure URL is encoded properly
    const encodedUrl = encodeURIComponent(url);
    
    // Call the URL shortening service
    const response = await axios.get(`https://click.wa.expert/api/sh?url=${encodedUrl}`);
    
    console.log(`🔗 URL shortened: ${url} → ${response.data.shortUrl || response.data}`);
    
    // Return the shortened URL or the original if shortening failed
    return response.data.shortUrl || response.data || url;
  } catch (error) {
    console.error("❌ Error shortening URL:", error.response ? error.response.data : error.message);
    // Return original URL if shortening fails
    return url;
  }
};

// Function to send task reminder to webhook
const sendTaskToWebhook = async (task) => {
  try {
    const payload = {
      id: task.id,
      task_name: task.task_name,
      task_file: task.task_file,
      notes: task.notes,
      assigned_to: task.assigned_to,
      assigned_by: task.assigned_by,
      department: task.department,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      pdf_url: task.pdf_url,  // Include the PDF URL
      schema_name: task.schema_name || 'danger', // Include schema info
      table_name: task.table_name || 'tasks',    // Include table info
      message: `Reminder: Task "${task.task_name}" is due today`
    };

    // UPDATED: Use webhook from task record or fall back to default
    const webhookUrl = task.webhook_task || "https://webhooks.wa.expert/webhook/682034da1f9f7b05384582b3";

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json"
      }
    });

    console.log(`✅ Sent to webhook: ${task.task_name} from ${task.schema_name || 'danger'}.${task.table_name || 'tasks'} | Time (IST): ${moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss")}`);
    console.log("🔗 Webhook Response:", response.data);

    return true;
  } catch (error) {
    console.error("❌ Error sending to webhook:", error.response ? error.response.data : error.message);
    throw error; // Re-throw to handle in consumer
  }
};
// Schedule task processing at 10:00 AM IST daily
// Format: minute hour day-of-month month day-of-week
cron.schedule("0 10 * * *", loadAllTasksDueToday, {
  timezone: "Asia/Kolkata"
});

// API endpoint to manually trigger task processing
app.post("/process-tasks", async (req, res) => {
  try {
    const { all_schemas = true } = req.body;
    
    if (all_schemas) {
      const tasksQueued = await loadAllTasksDueToday();
      res.status(200).json({ 
        message: "Task processing triggered successfully for all schemas", 
        tasksQueued,
        timestamp: moment().tz("Asia/Kolkata").format()
      });
    } else {
      await loadTasksDueToday();
      res.status(200).json({ 
        message: "Task processing triggered successfully for default schema", 
        timestamp: moment().tz("Asia/Kolkata").format()
      });
    }
  } catch (error) {
    console.error("❌ Error triggering task processing:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.toString() });
  }
});

// API endpoint to discover all task tables
app.get("/discover-task-tables", async (req, res) => {
  try {
    const tables = await discoverTaskTables();
    res.status(200).json({ 
      message: "Task tables discovered successfully", 
      tables,
      count: tables.length
    });
  } catch (error) {
    console.error("❌ Error discovering task tables:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.toString() });
  }
});

// API endpoint to create a new task
app.post("/tasks/create", async (req, res) => {
  try {
    const { 
      task_name, 
      task_file, 
      notes, 
      assigned_to, 
      assigned_by, 
      department, 
      priority, 
      status, 
      due_date,
      us_id,
      schema_name = 'danger' // Default schema if not specified
    } = req.body;
    
    if (!task_name || !assigned_to || !assigned_by || !due_date) {
      return res.status(400).json({ error: "Required fields are missing" });
    }

    // Generate a UUID for the task
    const id = uuidv4();
    
    // Set current date/time in IST
    const created_at = moment().tz("Asia/Kolkata").format();

    // Insert into database (now with configurable schema)
    const result = await pool.query(
      `INSERT INTO "${schema_name}".tasks (
        id, task_name, task_file, notes, assigned_to, assigned_by, 
        department, priority, status, due_date, us_id, created_at, processed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        id, task_name, task_file, notes, assigned_to, assigned_by, 
        department, priority, status, due_date, us_id, created_at, false
      ]
    );
    
    res.status(201).json({ 
      message: "Task created successfully", 
      task: result.rows[0],
      schema: schema_name
    });
  } catch (error) {
    console.error("❌ Error creating task:", error);
    res.status(500).json({ error: "Internal Server Error", message: error.toString() });
  }
});

// Initialize server
const startServer = async () => {
  try {
    // Connect to RabbitMQ first
    await connectRabbitMQ();
    
    // Then start the server
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`, new Date());
      console.log("📅 Task reminder system started...");
      
      // Check if we need to run the task processor now
      const now = moment().tz("Asia/Kolkata");
      if (now.hour() >= 10) {
        console.log("Starting initial task check across all schemas...");
        loadAllTasksDueToday();
      } else {
        console.log(`Waiting until 10:00 AM IST for scheduled task processing (current time: ${now.format("HH:mm")})`);
      }
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
