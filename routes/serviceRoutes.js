const { uploadFile, getUsersInReminder } = require("../controllers/serviceController");
const { registerUser, getUserDetails, logout, loginUser } = require("../controllers/userController");
const express = require("express");
const router = express.Router();


router.get("/uploadFile",uploadFile);
router.get("/reminders",getUsersInReminder);

module.exports = router;
