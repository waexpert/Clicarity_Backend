const express = require("express");
const { generateWebhooks, recieveData, captureData } = require("../controllers/webhookController");
const router = express.Router();

router.post("/genrateWebhook", generateWebhooks);
router.get('/:ownerId/:webhookId', recieveData);
router.get('/get/:ownerId/:webhookId', captureData);

module.exports = router;
