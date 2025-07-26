const { createRecord, updateRecord, createBulkRecord, getAllData, updateRecordWithTimeStamp, updateMultipleColumns, incrementByOne } = require("../controllers/dataController.js");
const express = require("express");
const router = express.Router();


router.post("/createRecord", createRecord);
router.get("/updateRecord",updateRecord);
router.post("/createBulkRecord",createBulkRecord)
router.post("/getAllData",getAllData)
router.post("/updateComment",updateRecordWithTimeStamp)
router.get("/updateMultiple",updateMultipleColumns)
router.get("/incrementbyone",incrementByOne)

module.exports = router;
