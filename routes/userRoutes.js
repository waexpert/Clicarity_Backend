const { registerUser, getUserDetails, logout, loginUser } = require("../controllers/userController");
const express = require("express");
const router = express.Router();


router.post("/register",registerUser);
router.post("/",getUserDetails);
router.post("/logout",logout);
router.post("/login",loginUser);

module.exports = router;
