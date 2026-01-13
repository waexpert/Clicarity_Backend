-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ROLES SETUP TABLE (PUBLIC SCHEMA)
-- Stores role configurations for data access control
-- ============================================
CREATE TABLE IF NOT EXISTS public.roles_setup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    us_id TEXT UNIQUE NOT NULL,
    owner_id TEXT NOT NULL,              -- References user.id from auth system
    schema_name TEXT NOT NULL,            -- Which tenant schema this role belongs to
    role_name TEXT NOT NULL,              -- Human-readable name (e.g., "Sales Team Filter")
    table_name TEXT NOT NULL,             -- Which table this role applies to
    role_config JSONB NOT NULL,           -- The filter configuration JSON
    is_active BOOLEAN DEFAULT true,       -- Can soft disable roles
    created_by TEXT,                      -- Who created this role
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS roles_setup_owner_idx ON public.roles_setup(owner_id);
CREATE INDEX IF NOT EXISTS roles_setup_schema_idx ON public.roles_setup(schema_name);
CREATE INDEX IF NOT EXISTS roles_setup_table_idx ON public.roles_setup(table_name);
CREATE INDEX IF NOT EXISTS roles_setup_active_idx ON public.roles_setup(is_active);
CREATE INDEX IF NOT EXISTS roles_setup_config_idx ON public.roles_setup USING GIN (role_config);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS roles_setup_owner_schema_idx 
    ON public.roles_setup(owner_id, schema_name);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_roles_setup_updated_at ON public.roles_setup;
CREATE TRIGGER update_roles_setup_updated_at 
    BEFORE UPDATE ON public.roles_setup 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TEAM MEMBER ROLES ASSIGNMENT TABLE (PUBLIC SCHEMA)
-- Maps team members to roles (cross-schema mapping)
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_member_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL,        -- ID from tenant's team_member table
    schema_name TEXT NOT NULL,            -- CRITICAL: Which schema this team member is in
    role_setup_id UUID NOT NULL REFERENCES public.roles_setup(id) ON DELETE CASCADE,
    assigned_by TEXT,                     -- Who assigned this role
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure a team member can't have the same role assigned twice
    UNIQUE(team_member_id, schema_name, role_setup_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS team_member_roles_member_idx 
    ON public.team_member_roles(team_member_id);
CREATE INDEX IF NOT EXISTS team_member_roles_role_idx 
    ON public.team_member_roles(role_setup_id);
CREATE INDEX IF NOT EXISTS team_member_roles_schema_idx 
    ON public.team_member_roles(schema_name);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS team_member_roles_member_schema_idx 
    ON public.team_member_roles(team_member_id, schema_name);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.roles_setup IS 'Stores role configurations for multi-tenant data access control';
COMMENT ON TABLE public.team_member_roles IS 'Maps team members to roles across tenant schemas';
COMMENT ON COLUMN public.team_member_roles.schema_name IS 'Critical: Identifies which tenant schema the team_member_id belongs to';
COMMENT ON COLUMN public.roles_setup.role_config IS 'JSONB structure: {filterName, table, columns: [], conditions: [{column, operator, value, logicalOperator}]}';
