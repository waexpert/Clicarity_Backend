const { uploadFile } = require("../controllers/serviceController");
const { registerUser, getUserDetails, logout, loginUser } = require("../controllers/userController");
const express = require("express");
const router = express.Router();


router.post("/uploadFile",uploadFile);

module.exports = router;
