const { createRecord, updateRecord, createBulkRecord, getAllData, updateRecordWithTimeStamp, updateMultipleColumns, incrementByOne, getAllPayments, getAllTables, getTableColumns } = require("../controllers/dataController.js");
const express = require("express");
const router = express.Router();


router.post("/createRecord", createRecord);
router.get("/updateRecord",updateRecord);
router.post("/createBulkRecord",createBulkRecord);
router.post("/getAllData",getAllData);
router.post("/updateComment",updateRecordWithTimeStamp);
router.get("/updateMultiple",updateMultipleColumns);
router.get("/incrementbyone",incrementByOne);
router.get("/getAllPayments",getAllPayments);
router.get("/getAllTables",getAllTables);
router.get("/getTableColumns",getTableColumns)

module.exports = router;
