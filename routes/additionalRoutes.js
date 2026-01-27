
const express = require("express");
const { handleSearch } = require("../controllers/additionalController");
const { authenticate } = require("../middlewares/auth");
const { getTeamMemberAccess } = require("../middlewares/teamMemberAuth");
const router = express.Router();

router.post("/search",
    authenticate,
    getTeamMemberAccess,
     handleSearch);

module.exports = router;

