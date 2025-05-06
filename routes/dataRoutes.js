const { createRecord, updateRecord, createBulkRecord } = require("../controllers/dataController.js");
const express = require("express");
const router = express.Router();


router.post("/createRecord", createRecord);
router.get("/updateRecord",updateRecord);
router.post("/createBulkRecord",createBulkRecord)

module.exports = router;
