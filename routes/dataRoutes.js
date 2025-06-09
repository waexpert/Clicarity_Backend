const { createRecord, updateRecord, createBulkRecord, getAllData } = require("../controllers/dataController.js");
const express = require("express");
const router = express.Router();


router.post("/createRecord", createRecord);
router.get("/updateRecord",updateRecord);
router.post("/createBulkRecord",createBulkRecord)
router.post("/getAllData",getAllData)

module.exports = router;
