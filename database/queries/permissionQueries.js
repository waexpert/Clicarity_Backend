// RLS Policy Creation and Management Queries

// Enable RLS on a table
const enableRLS = (schemaName, tableName) => {
    return `ALTER TABLE ${schemaName}.${tableName} ENABLE ROW LEVEL SECURITY;`;
};

// Disable RLS on a table
const disableRLS = (schemaName, tableName) => {
    return `ALTER TABLE ${schemaName}.${tableName} DISABLE ROW LEVEL SECURITY;`;
};

// Force RLS for table owners (even schema owners will be subject to RLS)
const forceRLS = (schemaName, tableName) => {
    return `ALTER TABLE ${schemaName}.${tableName} FORCE ROW LEVEL SECURITY;`;
};

// Create a policy for superadmin (no restrictions)
const createSuperAdminPolicy = (schemaName, tableName, policyName = 'superadmin_all_access') => {
    return `
        CREATE POLICY ${policyName} ON ${schemaName}.${tableName}
        FOR ALL
        TO PUBLIC
        USING (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.email = current_user
                AND users.role = 'superadmin'
            )
        );
    `;
};

// Create a policy for admin (can see all data in their own schema)
const createAdminPolicy = (schemaName, tableName, policyName = 'admin_schema_access') => {
    return `
        CREATE POLICY ${policyName} ON ${schemaName}.${tableName}
        FOR ALL
        TO PUBLIC
        USING (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.email = current_user
                AND users.role = 'admin'
                AND users.schema_name = '${schemaName}'
            )
        );
    `;
};

// Create a dynamic policy for members with custom conditions
const createMemberPolicy = (schemaName, tableName, condition, policyName = 'member_restricted_access') => {
    return `
        CREATE POLICY ${policyName} ON ${schemaName}.${tableName}
        FOR ALL
        TO PUBLIC
        USING (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.email = current_user
                AND users.role = 'member'
                AND users.schema_name = '${schemaName}'
            )
            AND (${condition})
        );
    `;
};

// Create a combined policy (all roles in one)
const createCombinedRLSPolicy = (schemaName, tableName, memberCondition, policyName = 'combined_rls_policy') => {
    return `
        CREATE POLICY ${policyName} ON ${schemaName}.${tableName}
        FOR ALL
        TO PUBLIC
        USING (
            -- SuperAdmin: No restrictions
            EXISTS (
                SELECT 1 FROM users
                WHERE users.email = current_user
                AND users.role = 'superadmin'
            )
            OR
            -- Admin: Access to all data in their schema
            EXISTS (
                SELECT 1 FROM users
                WHERE users.email = current_user
                AND users.role = 'admin'
                AND users.schema_name = '${schemaName}'
            )
            OR
            -- Member: Restricted access based on condition
            (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE users.email = current_user
                    AND users.role = 'member'
                    AND users.schema_name = '${schemaName}'
                )
                AND (${memberCondition})
            )
        );
    `;
};

// Drop a specific policy
const dropPolicy = (schemaName, tableName, policyName) => {
    return `DROP POLICY IF EXISTS ${policyName} ON ${schemaName}.${tableName};`;
};

// List all policies on a table
const listPolicies = () => {
    return `
        SELECT
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE schemaname = $1 AND tablename = $2;
    `;
};

// Check if RLS is enabled on a table
const checkRLSStatus = () => {
    return `
        SELECT
            n.nspname as schemaname,
            c.relname as tablename,
            c.relrowsecurity as rls_enabled,
            c.relforcerowlevel as force_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 
        AND c.relname = $2
        AND c.relkind = 'r';
    `;
};

// Get all tables in a schema with RLS status
const getAllTablesRLSStatus = () => {
    return `
        SELECT
            n.nspname as schemaname,
            c.relname as tablename,
            c.relrowsecurity as rls_enabled,
            c.relforcerowlevel as force_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1
        AND c.relkind = 'r'
        ORDER BY c.relname;
    `;
};

// Create a policy for SELECT operations only
const createSelectPolicy = (schemaName, tableName, condition, policyName = 'select_policy') => {
    return `
        CREATE POLICY ${policyName} ON ${schemaName}.${tableName}
        FOR SELECT
        TO PUBLIC
        USING (${condition});
    `;
};

// Create a policy for INSERT operations only
const createInsertPolicy = (schemaName, tableName, condition, policyName = 'insert_policy') => {
    return `
        CREATE POLICY ${policyName} ON ${schemaName}.${tableName}
        FOR INSERT
        TO PUBLIC
        WITH CHECK (${condition});
    `;
};

// Create a policy for UPDATE operations only
const createUpdatePolicy = (schemaName, tableName, condition, policyName = 'update_policy') => {
    return `
        CREATE POLICY ${policyName} ON ${schemaName}.${tableName}
        FOR UPDATE
        TO PUBLIC
        USING (${condition})
        WITH CHECK (${condition});
    `;
};

// Create a policy for DELETE operations only
const createDeletePolicy = (schemaName, tableName, condition, policyName = 'delete_policy') => {
    return `
        CREATE POLICY ${policyName} ON ${schemaName}.${tableName}
        FOR DELETE
        TO PUBLIC
        USING (${condition});
    `;
};

module.exports = {
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
};
