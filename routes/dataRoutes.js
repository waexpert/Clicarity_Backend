const { createRecord, updateRecord, createBulkRecord, getAllData, updateRecordWithTimeStamp, updateMultipleColumns, incrementByOne, getAllPayments, getAllTables, getTableColumns, deleteRecord, getRecordById, getRecordByTarget, getRecordByTargetAll, updateRecordBody, updateMultipleColumnsBody } = require("../controllers/dataController.js");
const express = require("express");
const { getTeamMemberAccess } = require("../middlewares/teamMemberAuth.js");
const { authenticate } = require("../middlewares/auth.js");
const router = express.Router();

router.post("/getRecordById",getRecordById);
router.post("/getRecordByTarget",getRecordByTarget);
router.post("/getRecordByTargetAll",getRecordByTargetAll);
router.post("/createRecord", createRecord);
router.get("/updateRecord",updateRecord);
router.post("/updateMultiple",updateMultipleColumnsBody);
router.post("/createBulkRecord",createBulkRecord);
router.post("/getAllData",
    authenticate,
    getTeamMemberAccess,
    getAllData);
router.post("/updateComment",updateRecordWithTimeStamp);
router.get("/updateMultiple",updateMultipleColumns);
router.get("/incrementbyone",incrementByOne);
router.get("/getAllPayments",getAllPayments);
router.get("/getAllTables",getAllTables);
router.get("/getTableColumns",getTableColumns);
router.get("/deleteRecord",deleteRecord);

module.exports = router;
