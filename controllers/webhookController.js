const { default: axios } = require('axios');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');

// In-memory storage for webhook data (use database in production)
const webhookStorage = new Map();

exports.generateWebhooks = async(req, res) => {
    const {ownerId, name, section} = req.body;
    const namespace = uuidv5.DNS;
    const stringInput = name;
    const webhookId = uuidv5(stringInput, namespace);
    
    const webhook = `${process.env.BASE_URL}/webhooks/${ownerId}/${webhookId}`;
    res.status(200).json({
        message: 'webhook created successfully',
        url: webhook,
        webhookId,
        ownerId
    });
}

exports.recieveData = async(req, res) => {
    try {
        const { ownerId, webhookId } = req.params;
        const webhookData = {
            query: req.query,
            body: req.body,
            headers: req.headers,
            timestamp: new Date().toISOString()
        };
        
        console.log(`\n=== WEBHOOK RECEIVED ===`);
        console.log(`Owner: ${ownerId}`);
        console.log(`Webhook: ${webhookId}`);
        console.log(`Data:`, webhookData);
        
        // Store the data using the key format
        const storageKey = `${ownerId}:${webhookId}`;
        webhookStorage.set(storageKey, webhookData);
        
        // No need to forward via HTTP call since we're storing in memory
        // The frontend will fetch the data directly from the GET endpoint
        
        res.status(200).json({
            message: "Data received and stored successfully",
            data: webhookData
        });
    } catch(e) {
        console.error('Error in recieveData:', e.message);
        res.status(400).json({message: "something went wrong", error: e.message});
    }
}

exports.captureData = (req, res) => {
    try {
        const { ownerId, webhookId } = req.params;
        const storageKey = `${ownerId}:${webhookId}`;
        
        // Get data from storage
        const storedData = webhookStorage.get(storageKey);
        
        if (storedData) {
            res.status(200).json({
                success: true,
                data: storedData
            });
        } else {
            res.status(404).json({
                success: false,
                message: "No data found for this webhook"
            });
        }
    } catch(e) {
        console.error('Error in captureData:', e);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}
