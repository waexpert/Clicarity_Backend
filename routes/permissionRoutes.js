const express = require("express");
const router = express.Router();
const {
    enableRowLevelSecurity,
    disableRowLevelSecurity,
    createDynamicRLSPolicy,
    createOperationSpecificPolicy,
    setupCompleteRLS,
    dropRLSPolicy,
    listTablePolicies,
    checkTableRLSStatus,
    getSchemaRLSStatus
} = require("../controllers/permissionController");

// Enable RLS on a table
router.post("/enable-rls", enableRowLevelSecurity);

// Disable RLS on a table
router.post("/disable-rls", disableRowLevelSecurity);

// Create dynamic RLS policy based on roles
router.post("/create-policy", createDynamicRLSPolicy);

// Create operation-specific policy (SELECT, INSERT, UPDATE, DELETE)
router.post("/create-operation-policy", createOperationSpecificPolicy);

// Complete RLS setup (enable RLS + create policy in one go)
router.post("/setup-complete-rls", setupCompleteRLS);

// Drop a specific policy
router.delete("/drop-policy", dropRLSPolicy);

// List all policies on a table
router.get("/list-policies", listTablePolicies);

// Check RLS status for a specific table
router.get("/check-rls-status", checkTableRLSStatus);

// Get RLS status for all tables in a schema
router.get("/schema-rls-status", getSchemaRLSStatus);

module.exports = router;
