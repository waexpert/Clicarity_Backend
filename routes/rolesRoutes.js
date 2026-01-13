// routes/roleRoutes.js
const express = require("express");
const router = express.Router();
const {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
  assignRole,
  removeRole,
  getMemberRoles,
  getTeamMembers,
  getTeamMemberDataAccess
} = require("../controllers/rolesController");

// ============================================
// ROLE SETUP CRUD OPERATIONS
// ============================================

// Create a new role configuration
router.post("/createRole", createRole);

// Get all roles (with optional filtering by schema/owner)
router.get("/getAllRoles", getAllRoles);

// Get a specific role by ID
router.get("/getRole/:id", getRoleById);

// Update an existing role
router.put("/updateRole/:id", updateRole);

// Delete a role (checks if assigned first)
router.delete("/deleteRole/:id", deleteRole);

// ============================================
// ROLE ASSIGNMENT OPERATIONS
// ============================================

// Assign a role to a team member
router.post("/assignRole", assignRole);

// Remove a role assignment
router.delete("/removeRole/:assignmentId", removeRole);

// Get all roles assigned to a specific team member
router.get("/getMemberRoles", getMemberRoles);

// ============================================
// TEAM MEMBER OPERATIONS
// ============================================

// Get all team members from a tenant's schema
router.get("/getTeamMembers", getTeamMembers);

// ============================================
// DATA ACCESS OPERATIONS
// ============================================

router.get("/getTeamMemberDataAccess", getTeamMemberDataAccess);

module.exports = router;