const { createSchema, createUser, createTable, createRoles, getAllRoles, createTeamMember, createView} = require("../controllers/secureControllers");
const express = require("express");
const router = express.Router();


router.post("/createSchema", createSchema);
router.post("/createUser",createUser);
router.post("/createTable",createTable);
router.post("/createRoles",createRoles);
router.post("/getAllRoles",getAllRoles);
router.post("/createTeamMember",createTeamMember);
router.post("/createViews",createView)

module.exports = router;
