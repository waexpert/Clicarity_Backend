const { createSchema, createUser, createTable, createRoles, getAllRoles, createTeamMember} = require("../controllers/secureControllers");
const express = require("express");
const router = express.Router();


router.post("/createSchema", createSchema);
router.post("/createUser",createUser);
router.post("/createTable",createTable);
router.post("/createRoles",createRoles);
router.post("/getAllRoles",getAllRoles);
router.post("/createTeamMember",createTeamMember);

module.exports = router;
