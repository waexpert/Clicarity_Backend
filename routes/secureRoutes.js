const { createSchema, createUser, createTable, createRoles, getAllRoles, createTeamMember, createView, getAllTeamMembers, getTableStructure} = require("../controllers/secureControllers");
const express = require("express");
const router = express.Router();


router.post("/createSchema", createSchema);
router.post("/createUser",createUser);
router.post("/createTable",createTable);
router.post("/createRoles",createRoles);
router.post("/getAllRoles",getAllRoles);
router.post("/createTeamMember",createTeamMember);
router.post("/createViews",createView);
router.post("/getAllTeamMembers",getAllTeamMembers);
router.post("/getTableStructure",getTableStructure);

module.exports = router;
