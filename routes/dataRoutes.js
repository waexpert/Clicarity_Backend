const { createRecord, updateRecord, createBulkRecord, getAllData, updateRecordWithTimeStamp, updateMultipleColumns } = require("../controllers/dataController.js");
const express = require("express");
const router = express.Router();


router.post("/createRecord", createRecord);
router.get("/updateRecord",updateRecord);
router.post("/createBulkRecord",createBulkRecord)
router.post("/getAllData",getAllData)
router.get("/updateComment",updateRecordWithTimeStamp)
router.get("/updateMultiple",updateMultipleColumns)

module.exports = router;
