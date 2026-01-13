const pool = require("../database/databaseConnection");
const {
    enableRLS,
    disableRLS,
    forceRLS,
    createSuperAdminPolicy,
    createAdminPolicy,
    createMemberPolicy,
    createCombinedRLSPolicy,
    dropPolicy,
    listPolicies,
    checkRLSStatus,
    getAllTablesRLSStatus,
    createSelectPolicy,
    createInsertPolicy,
    createUpdatePolicy,
    createDeletePolicy
} = require("../database/queries/permissionQueries");

// Enable Row Level Security on a table
exports.enableRowLevelSecurity = async (req, res) => {
    const client = await pool.connect();
    try {
        const { schemaName, tableName, force = false } = req.body;

        if (!schemaName || !tableName) {
            return res.status(400).json({
                success: false,
                error: "schemaName and tableName are required"
            });
        }

        // Validate schema and table exist
        const tableCheck = await client.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = $1 AND table_name = $2
            );`,
            [schemaName, tableName]
        );

        if (!tableCheck.rows[0].exists) {
            return res.status(404).json({
                success: false,
                error: `Table ${schemaName}.${tableName} does not exist`
            });
        }

        // Enable RLS
        await client.query(enableRLS(schemaName, tableName));

        // Optionally force RLS (applies to table owners too)
        if (force) {
            await client.query(forceRLS(schemaName, tableName));
        }

        res.status(200).json({
            success: true,
            message: `Row Level Security enabled on ${schemaName}.${tableName}`,
            forced: force
        });

    } catch (error) {
        console.error("Error enabling RLS:", error);
        res.status(500).json({
            success: false,
            error: "Failed to enable Row Level Security",
            details: error.message
        });
    } finally {
        client.release();
    }
};

// Disable Row Level Security on a table
exports.disableRowLevelSecurity = async (req, res) => {
    const client = await pool.connect();
    try {
        const { schemaName, tableName } = req.body;

        if (!schemaName || !tableName) {
            return res.status(400).json({
                success: false,
                error: "schemaName and tableName are required"
            });
        }

        await client.query(disableRLS(schemaName, tableName));

        res.status(200).json({
            success: true,
            message: `Row Level Security disabled on ${schemaName}.${tableName}`
        });

    } catch (error) {
        console.error("Error disabling RLS:", error);
        res.status(500).json({
            success: false,
            error: "Failed to disable Row Level Security",
            details: error.message
        });
    } finally {
        client.release();
    }
};

// Create dynamic RLS policy based on user role
exports.createDynamicRLSPolicy = async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            schemaName,
            tableName,
            condition,
            policyName,
            policyType = "combined" // combined, separate, or operation-specific
        } = req.body;

        if (!schemaName || !tableName) {
            return res.status(400).json({
                success: false,
                error: "schemaName and tableName are required"
            });
        }

        const finalPolicyName = policyName || `${tableName}_rls_policy`;

        await client.query('BEGIN');

        // Drop existing policy if it exists
        await client.query(dropPolicy(schemaName, tableName, finalPolicyName));

        if (policyType === "combined") {
            // Create a single combined policy for all roles
            const memberCondition = condition || "true"; // Default to no restriction if not provided
            await client.query(
                createCombinedRLSPolicy(schemaName, tableName, memberCondition, finalPolicyName)
            );
        } else if (policyType === "separate") {
            // Create separate policies for each role
            await client.query(
                createSuperAdminPolicy(schemaName, tableName, `${finalPolicyName}_superadmin`)
            );
            await client.query(
                createAdminPolicy(schemaName, tableName, `${finalPolicyName}_admin`)
            );
            if (condition) {
                await client.query(
                    createMemberPolicy(schemaName, tableName, condition, `${finalPolicyName}_member`)
                );
            }
        }

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: `RLS policy created successfully on ${schemaName}.${tableName}`,
            policyName: finalPolicyName,
            policyType,
            memberCondition: condition
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creating RLS policy:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create RLS policy",
            details: error.message
        });
    } finally {
        client.release();
    }
};

// Create operation-specific policies (SELECT, INSERT, UPDATE, DELETE)
exports.createOperationSpecificPolicy = async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            schemaName,
            tableName,
            operation, // select, insert, update, delete
            condition,
            policyName
        } = req.body;

        if (!schemaName || !tableName || !operation || !condition) {
            return res.status(400).json({
                success: false,
                error: "schemaName, tableName, operation, and condition are required"
            });
        }

        const finalPolicyName = policyName || `${tableName}_${operation}_policy`;

        await client.query('BEGIN');

        // Drop existing policy if it exists
        await client.query(dropPolicy(schemaName, tableName, finalPolicyName));

        // Create policy based on operation type
        switch (operation.toLowerCase()) {
            case 'select':
                await client.query(createSelectPolicy(schemaName, tableName, condition, finalPolicyName));
                break;
            case 'insert':
                await client.query(createInsertPolicy(schemaName, tableName, condition, finalPolicyName));
                break;
            case 'update':
                await client.query(createUpdatePolicy(schemaName, tableName, condition, finalPolicyName));
                break;
            case 'delete':
                await client.query(createDeletePolicy(schemaName, tableName, condition, finalPolicyName));
                break;
            default:
                throw new Error(`Invalid operation: ${operation}. Must be select, insert, update, or delete`);
        }

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: `${operation.toUpperCase()} policy created successfully`,
            policyName: finalPolicyName,
            operation,
            condition
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error creating operation-specific policy:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create operation-specific policy",
            details: error.message
        });
    } finally {
        client.release();
    }
};

// Complete RLS setup with enable + policy creation
exports.setupCompleteRLS = async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            schemaName,
            tableName,
            condition,
            policyName,
            force = true
        } = req.body;

        if (!schemaName || !tableName) {
            return res.status(400).json({
                success: false,
                error: "schemaName and tableName are required"
            });
        }

        const finalPolicyName = policyName || `${tableName}_rls_policy`;

        await client.query('BEGIN');

        // Step 1: Enable RLS on the table
        await client.query(enableRLS(schemaName, tableName));

        // Step 2: Force RLS (applies to table owners too)
        if (force) {
            await client.query(forceRLS(schemaName, tableName));
        }

        // Step 3: Drop existing policy if it exists
        await client.query(dropPolicy(schemaName, tableName, finalPolicyName));

        // Step 4: Create combined policy
        const memberCondition = condition || "true";
        await client.query(
            createCombinedRLSPolicy(schemaName, tableName, memberCondition, finalPolicyName)
        );

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            message: `Complete RLS setup successful on ${schemaName}.${tableName}`,
            details: {
                rlsEnabled: true,
                forced: force,
                policyName: finalPolicyName,
                memberCondition
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error setting up RLS:", error);
        res.status(500).json({
            success: false,
            error: "Failed to setup complete RLS",
            details: error.message
        });
    } finally {
        client.release();
    }
};

// Drop a specific policy
exports.dropRLSPolicy = async (req, res) => {
    const client = await pool.connect();
    try {
        const { schemaName, tableName, policyName } = req.body;

        if (!schemaName || !tableName || !policyName) {
            return res.status(400).json({
                success: false,
                error: "schemaName, tableName, and policyName are required"
            });
        }

        await client.query(dropPolicy(schemaName, tableName, policyName));

        res.status(200).json({
            success: true,
            message: `Policy ${policyName} dropped successfully from ${schemaName}.${tableName}`
        });

    } catch (error) {
        console.error("Error dropping policy:", error);
        res.status(500).json({
            success: false,
            error: "Failed to drop policy",
            details: error.message
        });
    } finally {
        client.release();
    }
};

// List all policies on a table
exports.listTablePolicies = async (req, res) => {
    try {
        const { schemaName, tableName } = req.query;

        if (!schemaName || !tableName) {
            return res.status(400).json({
                success: false,
                error: "schemaName and tableName are required"
            });
        }

        const result = await pool.query(listPolicies(), [schemaName, tableName]);

        res.status(200).json({
            success: true,
            schema: schemaName,
            table: tableName,
            policies: result.rows
        });

    } catch (error) {
        console.error("Error listing policies:", error);
        res.status(500).json({
            success: false,
            error: "Failed to list policies",
            details: error.message
        });
    }
};

// Check RLS status for a specific table
exports.checkTableRLSStatus = async (req, res) => {
    try {
        const { schemaName, tableName } = req.query;

        if (!schemaName || !tableName) {
            return res.status(400).json({
                success: false,
                error: "schemaName and tableName are required"
            });
        }

        const result = await pool.query(checkRLSStatus(), [schemaName, tableName]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: `Table ${schemaName}.${tableName} not found`
            });
        }

        res.status(200).json({
            success: true,
            schema: schemaName,
            table: tableName,
            rlsEnabled: result.rows[0].rls_enabled,
            forceRls: result.rows[0].force_rls
        });

    } catch (error) {
        console.error("Error checking RLS status:", error);
        res.status(500).json({
            success: false,
            error: "Failed to check RLS status",
            details: error.message
        });
    }
};

// Get RLS status for all tables in a schema
exports.getSchemaRLSStatus = async (req, res) => {
    try {
        const { schemaName } = req.query;

        if (!schemaName) {
            return res.status(400).json({
                success: false,
                error: "schemaName is required"
            });
        }

        const result = await pool.query(getAllTablesRLSStatus(), [schemaName]);

        res.status(200).json({
            success: true,
            schema: schemaName,
            tables: result.rows
        });

    } catch (error) {
        console.error("Error getting schema RLS status:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get schema RLS status",
            details: error.message
        });
    }
};
