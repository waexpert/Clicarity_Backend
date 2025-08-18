const { paymentReminderSetup, getPaymentReminderSetup, updatePaymentReminderSetup, checkDropdownSetup, updateDropdownSetup, createDropdownSetup } = require("../controllers/referenceController");
const express = require("express");
const router = express.Router();


router.post("/setup",paymentReminderSetup);
router.get("/getSetup",getPaymentReminderSetup);
router.post("/updateSetup",updatePaymentReminderSetup);
router.get("/setup/check",checkDropdownSetup);
router.put("/setup/update",updateDropdownSetup);
router.post("/setup/create",createDropdownSetup);


module.exports = router;