
// const http = require('http');
// const express = require("express");
// const path = require("path");
// const {Server} = require("socket.io");
// const cors = require("cors");
// const app = express();
// app.use(cors());


// const server = http.createServer(app);
// const io = new Server(server,{
//     cors:{
//         origin:"http://localhost:5173",
//         methods:["GET","POST"]
//     },
// });

// io.on("connection",(socket)=>{
//     console.log("A new user has connected",socket.id);

//     socket.on("send_message",(data)=>{
//       console.log(data);  
//     })
// })

// server.listen(9000,()=> console.log(`Server running on port 9000`))


const http = require('http');
const express = require("express");
const path = require("path");
const {Server} = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require('uuid'); // npm install uuid

const app = express();
app.use(cors());
app.use(express.json()); // Add this to parse JSON requests

const server = http.createServer(app);
const io = new Server(server,{
    cors:{
        origin:"http://localhost:5173",
        methods:["GET","POST"]
    },
});

// Store active connections by ownerId
const activeConnections = new Map();

// Store created webhooks (in production, use database)
const webhooks = new Map(
//     [
//     ['aeba2dba-0a20-4030-8f27-35ea0aa7d7a6', {
//         ownerId: 'bde74e9b-ee21-4687-8040-9878b88593fb',
//         name: 'test',
//         created: new Date().toISOString(),
//         active: true
//     }]
// ]
);
// Socket.io connection handling
io.on("connection",(socket)=>{
    console.log("A new user has connected", socket.id);

    // Handle your existing message functionality
    socket.on("send_message",(data)=>{
      console.log("Message received:", data);  
    });

    // NEW: Handle owner registration for webhook capturing
    socket.on("register-owner", (ownerId) => {
        console.log(`Owner ${ownerId} registered with socket ${socket.id}`);
        
        // Store the connection
        if (!activeConnections.has(ownerId)) {
            activeConnections.set(ownerId, new Set());
        }
        activeConnections.get(ownerId).add(socket.id);
        
        // Join a room specific to this owner
        socket.join(`owner-${ownerId}`);
        
        // Confirm registration
        socket.emit('registration-success', { 
            ownerId, 
            socketId: socket.id,
            message: 'Successfully registered for webhook capture'
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // Remove socket from all owner connections
        for (const [ownerId, sockets] of activeConnections.entries()) {
            if (sockets.has(socket.id)) {
                sockets.delete(socket.id);
                console.log(`Removed socket ${socket.id} from owner ${ownerId}`);
                if (sockets.size === 0) {
                    activeConnections.delete(ownerId);
                    console.log(`No more connections for owner ${ownerId}`);
                }
                break;
            }
        }
    });
});

// NEW: API endpoint to create webhooks
app.post('/webhooks/genrateWebhook', (req, res) => {
    try {
        const { ownerId, name } = req.body;
        
        if (!ownerId) {
            return res.status(400).json({ error: 'ownerId is required' });
        }
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Webhook name is required' });
        }

        const webhookId = uuidv4();
        const webhookUrl = `http://localhost:9000/webhooks/${ownerId}/${webhookId}`;
        
        // Store webhook info
        webhooks.set(webhookId, {
            ownerId,
            name: name.trim(),
            created: new Date().toISOString(),
            active: true
        });
        
        console.log(`Created webhook: ${webhookUrl}`);
        
        res.json({
            success: true,
            webhookId,
            webhookUrl,
            ownerId,
            name: name.trim()
        });

    } catch (error) {
        console.error('Error creating webhook:', error);
        res.status(500).json({ error: 'Failed to create webhook' });
    }
});

// NEW: Webhook endpoint - This receives data from external services
app.get('/webhooks/:ownerId/:webhookId', (req, res) => {
    try {
        const { ownerId, webhookId } = req.params;
        const webhookData = req.query; // ✅ Use req.query instead of req.params
        const headers = req.headers;
        
        console.log(`\n=== WEBHOOK RECEIVED ===`);
        console.log(`Owner: ${ownerId}`);
        console.log(`Webhook: ${webhookId}`);
        console.log(`Query Data:`, webhookData); // This will show {name: "test"}
        console.log(`Headers:`, headers);

        // Validate webhook exists and belongs to owner
        const webhookInfo = webhooks.get(webhookId);
        if (!webhookInfo) {
            console.log(`Webhook ${webhookId} not found`);
            return res.status(404).json({ error: 'Webhook not found' });
        }

        if (webhookInfo.ownerId !== ownerId) {
            console.log(`Webhook ${webhookId} doesn't belong to owner ${ownerId}`);
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!webhookInfo.active) {
            console.log(`Webhook ${webhookId} is inactive`);
            return res.status(410).json({ error: 'Webhook is inactive' });
        }

        // Create webhook event object
        const webhookEvent = {
            id: uuidv4(),
            ownerId,
            webhookId,
            webhookName: webhookInfo.name,
            timestamp: new Date().toISOString(),
            data: webhookData, // ✅ Now contains query parameters: {name: "test"}
            headers: {
                'content-type': headers['content-type'],
                'user-agent': headers['user-agent'],
                'x-forwarded-for': headers['x-forwarded-for'],
                'authorization': headers['authorization'] ? '[REDACTED]' : undefined,
            },
            source: headers['x-forwarded-for'] || req.ip || 'unknown'
        };

        // Check if owner has active connections
        const ownerConnections = activeConnections.get(ownerId);
        if (!ownerConnections || ownerConnections.size === 0) {
            console.log(`No active connections for owner ${ownerId} - webhook data will be lost`);
        } else {
            console.log(`Sending webhook data to ${ownerConnections.size} connection(s) for owner ${ownerId}`);
            // ✅ This will send the query data to the specific owner's frontend
            // io.to(`owner-${ownerId}`).emit('webhook-received', webhookEvent);
              io.to(socket.id).emit('webhook-received', webhookEvent);
        }
        
        console.log(`Webhook event sent to owner ${ownerId}`);
        console.log(`======================\n`);

        // Respond to webhook sender
        res.status(200).json({ 
            success: true, 
            message: 'Webhook received and processed successfully',
            eventId: webhookEvent.id,
            receivedData: webhookData // ✅ Show what data was received
        });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// NEW: API to get webhook info (for debugging)
app.get('/api/webhooks/:ownerId', (req, res) => {
    const { ownerId } = req.params;
    
    const ownerWebhooks = [];
    for (const [webhookId, info] of webhooks.entries()) {
        if (info.ownerId === ownerId) {
            ownerWebhooks.push({
                webhookId,
                ...info,
                url: `http://localhost:9000/webhooks/${ownerId}/${webhookId}`
            });
        }
    }
    
    res.json({
        ownerId,
        webhooks: ownerWebhooks,
        activeConnections: activeConnections.has(ownerId) ? activeConnections.get(ownerId).size : 0
    });
});

// NEW: API to get active connections (for debugging)
app.get('/api/debug/connections', (req, res) => {
    const connections = {};
    for (const [ownerId, sockets] of activeConnections.entries()) {
        connections[ownerId] = {
            socketCount: sockets.size,
            socketIds: Array.from(sockets)
        };
    }
    
    res.json({
        totalConnections: activeConnections.size,
        connections,
        totalWebhooks: webhooks.size
    });
});

// Test endpoint to simulate webhook calls
app.post('/api/test-webhook/:ownerId/:webhookId', (req, res) => {
    const { ownerId, webhookId } = req.params;
    
    // Simulate external service calling your webhook
    const testData = {
        event_type: 'test.webhook',
        test_id: uuidv4(),
        timestamp: new Date().toISOString(),
        data: {
            message: 'This is a test webhook call',
            amount: Math.floor(Math.random() * 1000) + 100,
            currency: 'USD'
        }
    };
    
    // Call your own webhook endpoint
    fetch(`http://localhost:9000/webhooks/${ownerId}/${webhookId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TestWebhookCaller/1.0'
        },
        body: JSON.stringify(testData)
    })
    .then(() => {
        res.json({ success: true, message: 'Test webhook sent', data: testData });
    })
    .catch(error => {
        res.status(500).json({ error: 'Failed to send test webhook', details: error.message });
    });
});

server.listen(9000, () => {
    console.log(`\n🚀 Server running on http://localhost:9000`);
    console.log(`📡 Socket.io enabled for real-time webhook delivery`);
    console.log(`🔗 Webhook endpoint: POST /webhooks/:ownerId/:webhookId`);
    console.log(`⚙️  API endpoints:`);
    console.log(`   - POST /api/create-webhook (create new webhook)`);
    console.log(`   - GET /api/webhooks/:ownerId (list owner's webhooks)`);
    console.log(`   - GET /api/debug/connections (debug info)`);
    console.log(`   - POST /api/test-webhook/:ownerId/:webhookId (test webhook)`);
    console.log(`\n✅ Ready to receive webhooks!\n`);
});