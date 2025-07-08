const amqp = require("amqplib");
const { v4: uuidv4 } = require('uuid');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const cron = require("node-cron");
const axios = require("axios");

// AWS SDK v3 imports
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');


// Configure AWS SDK v3
const s3Client = new S3Client({
  region: 'eu-north-1', // Your region
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});



// RabbitMQ setup
let channel; // RabbitMQ channel
const QUEUE_NAME = 'task_reminder_queue';

// Connect to RabbitMQ
// Connect to RabbitMQ - returns a promise
async function connectRabbitMQ() {
    return new Promise(async (resolve, reject) => {
        try {
            // Connect to RabbitMQ server
            const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
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
            
            // Connection successful
            resolve(connection);
        } catch (error) {
            console.error('❌ Error connecting to RabbitMQ:', error);
            
            // Start retry process but don't wait for it
            setTimeout(() => {
                connectRabbitMQ().catch(err => {
                    console.error("Reconnection attempt failed:", err.message);
                });
            }, 5000);
            
            // Reject the promise so the caller knows the connection failed
            reject(error);
        }
    });
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
        return []; // Return empty array instead of failing
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
        return 0; // Return 0 instead of crashing
    }
}

// Function to queue a task in RabbitMQ
// Function to queue a task in RabbitMQ
const queueTask = async (task) => {
    try {
        // Check if RabbitMQ channel is established
        if (!channel) {
            console.error("❌ RabbitMQ channel not established, will retry connecting");
            
            try {
                // Try to connect to RabbitMQ
                await connectRabbitMQ();
            } catch (connErr) {
                console.error("❌ Failed to connect to RabbitMQ:", connErr.message);
                throw new Error("RabbitMQ connection failed");
            }
            
            // If we still don't have a channel, throw an error
            if (!channel) {
                throw new Error("RabbitMQ channel still not established after connection attempt");
            }
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
        return true;
    } catch (error) {
        console.error("❌ Error queuing task:", error.message);
        throw error; // Re-throw so the caller knows it failed
    }
};

//smplified PDF generation function
async function generateSimplePdf(tasks) {
  try {
    // Get the first task's assigned_to as the filename
    const employeeName = tasks[0].assigned_to;
    const filename = `${employeeName.replace(/\s+/g, '_')}_Tasks.pdf`;
    
    // Create PDF document
    const pdfDoc = new PDFDocument({
      margin: 20,
      size: 'A4',
      layout: 'portrait'
    });
    
    // Set up file writing
    const writeStream = fs.createWriteStream(filename);
    pdfDoc.pipe(writeStream);

    // Add simple content - you can keep your existing PDF generation code here
    pdfDoc.fontSize(24)
      .font('Helvetica-Bold')
      .text('Tasks Report', {
        align: 'center'
      });

    pdfDoc.moveDown(1);

    pdfDoc.fontSize(14)
      .font('Helvetica')
      .text(`Tasks for: ${employeeName}`, {
        align: 'left'
      });

    pdfDoc.moveDown(1);

    // Add tasks in a simple table
    tasks.forEach((task, index) => {
      pdfDoc.fontSize(12)
        .text(`${index + 1}. ${task.task_name}`, {
          continued: false
        });
      
      pdfDoc.fontSize(10)
        .text(`Due Date: ${new Date(task.due_date).toLocaleDateString()}`, {
          indent: 20
        });
      
      pdfDoc.fontSize(10)
        .text(`Notes: ${task.notes || 'None'}`, {
          indent: 20
        });
      
      pdfDoc.moveDown(0.5);
    });

    // End the PDF creation
    pdfDoc.end();

    // Wait for the PDF to be written
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`Created PDF: ${filename}`);

    // Upload to S3
    try {
      const fileContent = fs.readFileSync(filename);
      const s3Key = `employee-tasks/${filename}`;

      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'application/pdf',
      };

      // Upload file using v3 SDK
      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      console.log(`Uploaded ${filename} to S3: ${s3Key}`);

      // Generate signed URL
      const getCommand = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key
      });

      const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 259200 }); // 3 days
      console.log(`Generated signed URL: ${url}`);

      // Clean up the local file
      fs.unlinkSync(filename);

      return url;
    } catch (error) {
      console.error("Error uploading PDF to S3:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}

// Function to generate PDF for a task - SIMPLIFIED
const generatePdfForTask = async (task) => {
  try {
    // Extract schema and table information from the task
    const schema_name = task.schema_name || 'danger'; 
    const table_name = task.table_name || 'tasks';    

    console.log(`Generating PDF for task: ${task.task_name} assigned to ${task.assigned_to}`);

    // Get all tasks for this assigned person (without the processed=false condition)
    const { rows } = await pool.query(
      `SELECT * FROM "${schema_name}"."${table_name}" 
       WHERE assigned_to = $1`,
      [task.assigned_to]
    );

    console.log(`Found ${rows.length} tasks for ${task.assigned_to} in ${schema_name}.${table_name}`);

    // Check if tasks were found
    if (rows.length === 0) {
      console.log(`No tasks found for ${task.assigned_to}`);
      throw new Error(`No tasks found for ${task.assigned_to}`);
    }

    // Use direct API call instead of trying to generate PDF locally
    console.log(`Calling API to generate PDF for ${task.assigned_to}`);
    
    // Use axios with a timeout to prevent hanging
    const response = await axios.get(
      `https://click.wa.expert/api/generatePdf?schemaName=${schema_name}&tableName=${table_name}&assignedTo=${task.assigned_to}`,
      { timeout: 10000 } // 10 second timeout
    );
    
    // Check if we got a valid response with download URL
    if (!response.data || !response.data.downloadUrl) {
      throw new Error('API did not return a valid download URL');
    }
    
    console.log(`📄 PDF URL received for ${task.assigned_to}: ${response.data.downloadUrl}`);
    
    // No need to shorten URL if we're having issues - just return the URL directly
    return response.data.downloadUrl;
  } catch (error) {
    console.error("❌ Error generating PDF:", error.message);
    
    // If we can't generate a PDF, create a placeholder URL that still works
    const fallbackUrl = `https://click.wa.expert/no-pdf-available?assignedTo=${encodeURIComponent(task.assigned_to)}`;
    console.log(`⚠️ Using fallback URL: ${fallbackUrl}`);
    
    return fallbackUrl;
  }
};

// Function to send task reminder to webhook - SIMPLIFIED
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
      pdf_url: task.pdf_url,  // Simple link or whatever URL was set
      schema_name: task.schema_name || 'danger',
      table_name: task.table_name || 'tasks',
      message: `Reminder: Task "${task.task_name}" is due today`
    };

    // Use webhook from task record or fall back to default
    const webhookUrl = task.webhook_task || "https://webhooks.wa.expert/webhook/682034da1f9f7b05384582b3";
    
    console.log(`Using webhook URL: ${webhookUrl} for task ${task.task_name}`);

    // Set timeout on request to prevent hanging
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 5000 // 5 second timeout
    });

    console.log(`✅ Sent to webhook: ${task.task_name} | Time (IST): ${moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss")}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending to webhook:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data));
    }
    throw error;
  }
};

// Function to consume tasks from RabbitMQ queue - SIMPLIFIED
const consumeTasks = async () => {
  try {
    // Set up consumer with manual acknowledgment
    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;
      
      let task;
      
      try {
        // Parse the message
        task = JSON.parse(msg.content.toString());
        console.log(`🔔 Processing task: ${task.task_name}`);

        try {
          // Try to generate a PDF URL
          const pdfUrl = await generatePdfForTask(task);
          task.pdf_url = pdfUrl;
        } catch (pdfError) {
          console.error("❌ Error generating PDF, using fallback URL:", pdfError.message);
          task.pdf_url = `https://click.wa.expert/view-tasks?assigned_to=${encodeURIComponent(task.assigned_to)}`;
        }
        
        // Send the webhook
        await sendTaskToWebhook(task);
        
        // Acknowledge the message
        channel.ack(msg);
        console.log(`✅ Task processed and acknowledged: ${task.task_name}`);
      } catch (error) {
        console.error("❌ Error processing task:", error.message);
        
        // Avoid requeuing tasks that have data parsing issues
        if (!task) {
          console.log("❌ Message parsing failed, not requeuing");
          channel.ack(msg);
        } else {
          // For other errors, nack with requeue
          channel.nack(msg, false, true);
        }
      }
    }, { noAck: false }); // Manual acknowledgment

    console.log("🎧 Task consumer started");
  } catch (error) {
    console.error("❌ Error setting up task consumer:", error);
  }
};

// Create URL shortening table if it doesn't exist
const initDatabase = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shortened_urls (
                id SERIAL PRIMARY KEY,
                original_url TEXT NOT NULL,
                short_code VARCHAR(10) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('URL shortening database initialized successfully');
    } catch (error) {
        console.error('Error initializing URL shortening database:', error);
    }
};

// Schedule task processing at 10:00 AM IST daily
// Format: minute hour day-of-month month day-of-week
cron.schedule("0 10 * * *", loadAllTasksDueToday, {
    timezone: "Asia/Kolkata"
});

// PDF Generation endpoint - SIMPLIFIED
app.get("/generatePdf", async (req, res) => {
  try {
    const { schemaName, tableName, assignedTo } = req.query;
    
    // Validate required parameters
    if (!schemaName || !tableName || !assignedTo) {
      return res.status(400).json({ 
        error: "Missing required parameters", 
        message: "schemaName, tableName, and assignedTo are required" 
      });
    }
    
    console.log(`Generating PDF for ${assignedTo} from ${schemaName}.${tableName}`);
    
    // Sanitize inputs to prevent SQL injection
    const sanitizedQuery = `
      SELECT * FROM "${schemaName}"."${tableName}" WHERE assigned_to = $1;  
    `;
    
    const result = await pool.query(sanitizedQuery, [assignedTo]);
    
    // Check if we have tasks
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ 
        error: "No tasks found", 
        message: `No tasks found for ${assignedTo} in ${schemaName}.${tableName}` 
      });
    }
    
    console.log(`Found ${result.rows.length} tasks for ${assignedTo}, generating PDF...`);
    
    // Use a simplified version that just returns the URL
    const pdfUrl = await generateSimplePdf(result.rows);
    
    // Return the URL in the response
    return res.json({ downloadUrl: pdfUrl });
    
  } catch (error) {
    console.error("❌ Error generating PDF:", error);
    return res.status(500).json({ 
      error: "Error generating PDF", 
      message: error.message 
    });
  }
});

// Direct PDF download link
app.get("/download-pdf", async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).send("URL parameter is required");
    }
    
    console.log(`Downloading PDF from URL: ${url}`);
    
    // Fetch the PDF
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 10000 // 10 second timeout
    });
    
    // Set headers to force download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks.pdf"');
    
    // Pipe the PDF to the response
    response.data.pipe(res);
  } catch (error) {
    console.error("Error serving PDF:", error.message);
    if (!res.headersSent) {
      res.status(500).send("Error downloading PDF");
    }
  }
});

// Task processing endpoints
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

// Task table discovery endpoint
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

// Task creation endpoint
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
            webhook_task,  // Added explicit webhook_task field handling
            schema_name = 'danger' // Default schema if not specified
        } = req.body;

        if (!task_name || !assigned_to || !assigned_by || !due_date) {
            return res.status(400).json({ error: "Required fields are missing" });
        }

        // Generate a UUID for the task
        const id = uuidv4();

        // Set current date/time in IST
        const created_at = moment().tz("Asia/Kolkata").format();

        // Insert into database (now with configurable schema and webhook_task field)
        const result = await pool.query(
            `INSERT INTO "${schema_name}".tasks (
                id, task_name, task_file, notes, assigned_to, assigned_by, 
                department, priority, status, due_date, us_id, created_at, processed, webhook_task
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [
                id, task_name, task_file, notes, assigned_to, assigned_by,
                department, priority, status, due_date, us_id, created_at, false, webhook_task
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