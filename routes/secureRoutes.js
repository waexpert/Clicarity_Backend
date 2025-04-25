const { createSchema, createUser, createTable} = require("../controllers/secureControllers");
const express = require("express");
const router = express.Router();


router.post("/createSchema", createSchema);
router.post("/createUser",createUser);
router.post("/createTable",createTable);

module.exports = router;
