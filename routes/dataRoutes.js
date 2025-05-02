const { createRecord, updateRecord } = require("../controllers/dataController.js");
const express = require("express");
const router = express.Router();


router.post("/createRecord", createRecord);
router.get("/updateRecord",updateRecord)

module.exports = router;
