const pool = require("../database/databaseConnection");
const { v4: uuidv4 } = require("uuid");

// ============================================
// CREATE ROLE
// ============================================
exports.createRole = async (req, res) => {
  try {
    const {
      ownerId,
      schemaName,
      roleName,
      tableName,
      roleConfig,
      createdBy
      
    } = req.body;

    // Validate required fields
    if (!ownerId || !schemaName || !roleName || !tableName || !roleConfig) {
      return res.status(400).json({
        message: "Missing required fields: ownerId, schemaName, roleName, tableName, roleConfig"
      });
    }

    const us_id = `role_${uuidv4()}`;

    const query = `
      INSERT INTO public.roles_setup 
        (us_id, owner_id, schema_name, role_name, table_name, role_config, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const result = await pool.query(query, [
      us_id,
      ownerId,
      schemaName,
      roleName,
      tableName,
      JSON.stringify(roleConfig),
      createdBy || null
    ]);

    res.status(201).json({
      message: "Role created successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Error creating role:", err);
    res.status(500).json({
      message: "Error creating role",
      error: err.message
    });
  }
};

// ============================================
// GET ALL ROLES
// ============================================
exports.getAllRoles = async (req, res) => {
  try {
    const { schemaName, ownerId, isActive } = req.query;

    let query = `
      SELECT 
        id,
        us_id,
        owner_id,
        schema_name,
        role_name,
        table_name,
        role_config,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM public.roles_setup
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (schemaName) {
      query += ` AND schema_name = $${paramIndex}`;
      params.push(schemaName);
      paramIndex++;
    }

    if (ownerId) {
      query += ` AND owner_id = $${paramIndex}`;
      params.push(ownerId);
      paramIndex++;
    }

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(isActive === 'true' || isActive === true);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC;`;

    const result = await pool.query(query, params);

    const formattedData = result.rows.map(row => ({
      id: row.id,
      us_id: row.us_id,
      owner_id: row.owner_id,
      schema_name: row.schema_name,
      role_name: row.role_name,
      table_name: row.table_name,
      role_config: row.role_config,
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    res.status(200).json({
      message: "Roles fetched successfully",
      data: formattedData,
      count: formattedData.length
    });

  } catch (err) {
    console.error("Error fetching roles:", err);
    res.status(500).json({
      message: "Error fetching roles",
      error: err.message
    });
  }
};

// ============================================
// GET ROLE BY ID
// ============================================
exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT * FROM public.roles_setup
      WHERE id = $1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Role not found"
      });
    }

    res.status(200).json({
      message: "Role fetched successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Error fetching role:", err);
    res.status(500).json({
      message: "Error fetching role",
      error: err.message
    });
  }
};

// ============================================
// UPDATE ROLE
// ============================================
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleName, tableName, roleConfig, isActive } = req.body;

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (roleName !== undefined) {
      updates.push(`role_name = $${paramIndex}`);
      params.push(roleName);
      paramIndex++;
    }

    if (tableName !== undefined) {
      updates.push(`table_name = $${paramIndex}`);
      params.push(tableName);
      paramIndex++;
    }

    if (roleConfig !== undefined) {
      updates.push(`role_config = $${paramIndex}`);
      params.push(JSON.stringify(roleConfig));
      paramIndex++;
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        message: "No fields to update"
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE public.roles_setup
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Role not found"
      });
    }

    res.status(200).json({
      message: "Role updated successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Error updating role:", err);
    res.status(500).json({
      message: "Error updating role",
      error: err.message
    });
  }
};

// ============================================
// DELETE ROLE
// ============================================
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    // First check if role is assigned to any team members
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM public.team_member_roles
      WHERE role_setup_id = $1;
    `;
    
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(409).json({
        message: "Cannot delete role. It is assigned to team members. Please remove assignments first.",
        assignedCount: parseInt(checkResult.rows[0].count)
      });
    }

    const query = `
      DELETE FROM public.roles_setup
      WHERE id = $1
      RETURNING *;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Role not found"
      });
    }

    res.status(200).json({
      message: "Role deleted successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Error deleting role:", err);
    res.status(500).json({
      message: "Error deleting role",
      error: err.message
    });
  }
};

// ============================================
// ASSIGN ROLE TO TEAM MEMBER
// ============================================
exports.assignRole = async (req, res) => {
  try {
    const { teamMemberId, roleSetupId, schemaName, assignedBy } = req.body;

    if (!teamMemberId || !roleSetupId || !schemaName) {
      return res.status(400).json({
        message: "Team member ID, role ID, and schema name are required"
      });
    }

    // Verify the role exists and is active
    const roleCheck = `
      SELECT * FROM public.roles_setup
      WHERE id = $1 AND is_active = true;
    `;
    
    const roleResult = await pool.query(roleCheck, [roleSetupId]);
    
    if (roleResult.rows.length === 0) {
      return res.status(404).json({
        message: "Role not found or inactive"
      });
    }

    // Check if assignment already exists
    const checkQuery = `
      SELECT * FROM public.team_member_roles
      WHERE team_member_id = $1 
        AND schema_name = $2 
        AND role_setup_id = $3;
    `;
    
    const checkResult = await pool.query(checkQuery, [teamMemberId, schemaName, roleSetupId]);
    
    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        message: "This role is already assigned to the team member"
      });
    }

    const query = `
      INSERT INTO public.team_member_roles 
        (team_member_id, schema_name, role_setup_id, assigned_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const result = await pool.query(query, [
      teamMemberId,
      schemaName,
      roleSetupId,
      assignedBy || null
    ]);

    res.status(201).json({
      message: "Role assigned successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Error assigning role:", err);
    res.status(500).json({
      message: "Error assigning role",
      error: err.message
    });
  }
};

// ============================================
// REMOVE ROLE FROM TEAM MEMBER
// ============================================
exports.removeRole = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const query = `
      DELETE FROM public.team_member_roles
      WHERE id = $1
      RETURNING *;
    `;

    const result = await pool.query(query, [assignmentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Role assignment not found"
      });
    }

    res.status(200).json({
      message: "Role removed successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Error removing role:", err);
    res.status(500).json({
      message: "Error removing role",
      error: err.message
    });
  }
};

// ============================================
// GET ROLES FOR A TEAM MEMBER
// ============================================
exports.getMemberRoles = async (req, res) => {
  try {
    const { teamMemberId, schemaName } = req.query;

    if (!teamMemberId || !schemaName) {
      return res.status(400).json({
        message: "Team member ID and schema name are required"
      });
    }

    const query = `
      SELECT 
        tmr.id,
        tmr.team_member_id,
        tmr.schema_name,
        tmr.role_setup_id,
        tmr.assigned_by,
        tmr.assigned_at,
        rs.role_name,
        rs.table_name,
        rs.role_config,
        rs.is_active
      FROM public.team_member_roles tmr
      JOIN public.roles_setup rs ON tmr.role_setup_id = rs.id
      WHERE tmr.team_member_id = $1
        AND tmr.schema_name = $2
        AND rs.is_active = true
      ORDER BY tmr.assigned_at DESC;
    `;

    const result = await pool.query(query, [teamMemberId, schemaName]);

    const formattedData = result.rows.map(row => ({
      id: row.id,
      teamMemberId: row.team_member_id,
      schemaName: row.schema_name,
      roleSetupId: row.role_setup_id,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      roleName: row.role_name,
      tableName: row.table_name,
      columns: row.role_config?.columns || [],
      conditions: row.role_config?.conditions || [],
      isActive: row.is_active
    }));

    res.status(200).json({
      message: "Member roles fetched successfully",
      data: formattedData,
      count: formattedData.length
    });

  } catch (err) {
    console.error("Error fetching member roles:", err);
    res.status(500).json({
      message: "Error fetching member roles",
      error: err.message
    });
  }
};

// ============================================
// GET TEAM MEMBERS (from user's schema)
// ============================================
exports.getTeamMembers = async (req, res) => {
  try {
    const { schemaName, ownerId } = req.query;

    if (!schemaName) {
      return res.status(400).json({
        message: "Schema name is required"
      });
    }

    // Query team members from the specific schema
    let query = `
      SELECT 
        id,
        name,
        email,
        phone_number,
        first_name,
        last_name,
        department,
        role,
        empid,
        manager_name,
        created_at
      FROM "${schemaName}".team_member
      WHERE 1=1
    `;

    const params = [];
    
    if (ownerId) {
      query += ` AND owner_id = $1`;
      params.push(ownerId);
    }

    query += ` ORDER BY COALESCE(name, first_name, '');`;

    const result = await pool.query(query, params);

    res.status(200).json({
      message: "Team members fetched successfully",
      data: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error("Error fetching team members:", err);
    
    // Handle case where schema doesn't exist
    if (err.code === '42P01') {
      return res.status(404).json({
        message: `Schema "${req.query.schemaName}" or table "team_member" does not exist`,
        error: err.message
      });
    }
    
    res.status(500).json({
      message: "Error fetching team members",
      error: err.message
    });
  }
};

// ============================================
// GET EFFECTIVE DATA ACCESS FOR TEAM MEMBER
// Used when team member logs in to determine their data access
// ============================================
exports.getTeamMemberDataAccess = async (req, res) => {
  try {
    const { teamMemberId, schemaName, tableName } = req.query;

    if (!teamMemberId || !schemaName) {
      return res.status(400).json({
        message: "Team member ID and schema name are required"
      });
    }

    let query = `
      SELECT 
        rs.id as role_id,
        rs.role_name,
        rs.table_name,
        rs.role_config
      FROM public.team_member_roles tmr
      JOIN public.roles_setup rs ON tmr.role_setup_id = rs.id
      WHERE tmr.team_member_id = $1
        AND tmr.schema_name = $2
        AND rs.is_active = true
    `;

    const params = [teamMemberId, schemaName];

    // If specific table requested, filter by table
    if (tableName) {
      query += ` AND rs.table_name = $3`;
      params.push(tableName);
    }

    query += ` ORDER BY rs.table_name, rs.created_at;`;

    const result = await pool.query(query, params);

    // Group by table for easier application
    const dataAccess = {};
    result.rows.forEach(row => {
      if (!dataAccess[row.table_name]) {
        dataAccess[row.table_name] = {
          tableName: row.table_name,
          roles: []
        };
      }
      
      dataAccess[row.table_name].roles.push({
        roleId: row.role_id,
        roleName: row.role_name,
        columns: row.role_config?.columns || [],
        conditions: row.role_config?.conditions || []
      });
    });

    res.status(200).json({
      message: "Data access fetched successfully",
      data: dataAccess,
      hasRestrictions: result.rows.length > 0,
      tableCount: Object.keys(dataAccess).length
    });

  } catch (err) {
    console.error("Error fetching data access:", err);
    res.status(500).json({
      message: "Error fetching data access",
      error: err.message
    });
  }
};