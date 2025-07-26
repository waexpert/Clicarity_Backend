const { paymentReminderSetup, getPaymentReminderSetup } = require("../controllers/referenceController");
const express = require("express");
const router = express.Router();


router.post("/setup",paymentReminderSetup);
router.get("/getSetup",getPaymentReminderSetup);


module.exports = router;