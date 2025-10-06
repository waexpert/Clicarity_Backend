const { createRecord, updateRecord, createBulkRecord, getAllData, updateRecordWithTimeStamp, updateMultipleColumns, incrementByOne, getAllPayments, getAllTables, getTableColumns, deleteRecord, getRecordById, getRecordByTarget } = require("../controllers/dataController.js");
const express = require("express");
const router = express.Router();

router.post("/getRecordById",getRecordById);
router.post("/getRecordByTarget",getRecordByTarget);
router.post("/createRecord", createRecord);
router.get("/updateRecord",updateRecord);
router.post("/createBulkRecord",createBulkRecord);
router.post("/getAllData",getAllData);
router.post("/updateComment",updateRecordWithTimeStamp);
router.get("/updateMultiple",updateMultipleColumns);
router.get("/incrementbyone",incrementByOne);
router.get("/getAllPayments",getAllPayments);
router.get("/getAllTables",getAllTables);
router.get("/getTableColumns",getTableColumns);
router.get("/deleteRecord",deleteRecord);

module.exports = router;
