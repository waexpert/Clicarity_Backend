const { createSchema, createUser, createTable, createRoles, getAllRoles, createTeamMember, createView, getAllTeamMembers, getTableStructure, generateAlterTableQuery, alterTable} = require("../controllers/secureControllers");
const express = require("express");
const router = express.Router();


router.post("/createSchema", createSchema);
router.post("/createUser",createUser);
router.post("/createTable",createTable);
router.post("/alterTable",alterTable);
router.post("/createRoles",createRoles);
router.post("/getAllRoles",getAllRoles);
router.post("/createTeamMember",createTeamMember);
router.post("/createViews",createView);
router.post("/getAllTeamMembers",getAllTeamMembers);
router.post("/getTableStructure",getTableStructure);
router.post("/addColumnsToTable",generateAlterTableQuery);
module.exports = router;

