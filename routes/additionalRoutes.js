
const express = require("express");
const { handleSearch } = require("../controllers/additionalController");
const router = express.Router();

router.get("/search", handleSearch);

module.exports = router;

