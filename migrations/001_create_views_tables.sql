/**
 * Migration: Create Custom Views Tables
 *
 * This migration creates the necessary tables for storing custom database views
 * created through the View Builder interface.
 *
 * Tables created:
 * 1. view_folders - Organizes views into folders
 * 2. custom_views - Stores view metadata and configuration
 */

-- ============================================================================
-- TABLE: view_folders
-- Description: Stores folders for organizing views
-- ============================================================================
CREATE TABLE IF NOT EXISTS view_folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create default folders
INSERT INTO view_folders (name) VALUES
  ('JobStatus Views'),
  ('LeadStatus Views'),
  ('PaymentStatus Views'),
  ('TaskStatus Views'),
  ('Custom Views')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- TABLE: custom_views
-- Description: Stores metadata and configuration for custom database views
-- ============================================================================
CREATE TABLE IF NOT EXISTS custom_views (
  id SERIAL PRIMARY KEY,

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  sql_view_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  folder_id INTEGER REFERENCES view_folders(id) ON DELETE SET NULL,

  -- View Configuration (stored as JSONB for flexibility)
  selected_tables JSONB NOT NULL DEFAULT '[]',
  selected_columns JSONB NOT NULL DEFAULT '[]',
  joins JSONB NOT NULL DEFAULT '[]',
  where_conditions JSONB NOT NULL DEFAULT '[]',
  team_members JSONB NOT NULL DEFAULT '[]',

  -- SQL
  sql TEXT NOT NULL,

  -- Metadata
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Looker Studio Integration
  looker_studio_connected BOOLEAN DEFAULT FALSE,
  looker_studio_report_url TEXT,

  -- Indexes
  CONSTRAINT unique_sql_view_name UNIQUE (sql_view_name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_views_folder ON custom_views(folder_id);
CREATE INDEX IF NOT EXISTS idx_custom_views_created_at ON custom_views(created_at);
CREATE INDEX IF NOT EXISTS idx_custom_views_name ON custom_views(name);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================
COMMENT ON TABLE view_folders IS 'Stores folders for organizing custom database views';
COMMENT ON TABLE custom_views IS 'Stores metadata and configuration for custom database views created through the View Builder';

COMMENT ON COLUMN custom_views.name IS 'Display name of the view (user-friendly)';
COMMENT ON COLUMN custom_views.sql_view_name IS 'Actual PostgreSQL view name (snake_case, prefixed with vw_)';
COMMENT ON COLUMN custom_views.selected_tables IS 'JSON array of selected tables with their columns';
COMMENT ON COLUMN custom_views.selected_columns IS 'JSON array of columns included in the view';
COMMENT ON COLUMN custom_views.joins IS 'JSON array of table join definitions';
COMMENT ON COLUMN custom_views.where_conditions IS 'JSON array of WHERE clause conditions';
COMMENT ON COLUMN custom_views.team_members IS 'JSON array of team member IDs who can access this view';
COMMENT ON COLUMN custom_views.sql IS 'The complete CREATE VIEW SQL statement';

-- ============================================================================
-- EXAMPLE DATA (for testing purposes)
-- ============================================================================

-- Example: Create a sample view folder and view
-- INSERT INTO view_folders (name) VALUES ('Sample Views');
--
-- INSERT INTO custom_views (
--   name,
--   sql_view_name,
--   description,
--   folder_id,
--   selected_tables,
--   selected_columns,
--   joins,
--   where_conditions,
--   team_members,
--   sql
-- ) VALUES (
--   'Active Jobs Overview',
--   'vw_active_jobs',
--   'Shows all active jobs with customer details',
--   (SELECT id FROM view_folders WHERE name = 'Sample Views'),
--   '[{"name":"jobs","columns":[{"name":"id","type":"integer"},{"name":"title","type":"varchar"}]}]',
--   '[{"key":"jobs.id","table":"jobs","column":"id","alias":"job_id","type":"integer"}]',
--   '[]',
--   '[{"id":1,"column":"jobs.status","operator":"=","value":"active","logicalOperator":"AND"}]',
--   '["1","2"]',
--   'CREATE OR REPLACE VIEW vw_active_jobs AS SELECT jobs.id AS job_id FROM jobs WHERE jobs.status = ''active'';'
-- );

-- ============================================================================
-- FUNCTIONS (Optional - for automatic timestamp updates)
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for view_folders
CREATE TRIGGER update_view_folders_updated_at
  BEFORE UPDATE ON view_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for custom_views
CREATE TRIGGER update_custom_views_updated_at
  BEFORE UPDATE ON custom_views
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GRANTS (Optional - adjust based on your user roles)
-- ============================================================================

-- Grant permissions to your application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON view_folders TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON custom_views TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE view_folders_id_seq TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE custom_views_id_seq TO your_app_user;

-- ============================================================================
-- ROLLBACK (in case you need to undo this migration)
-- ============================================================================

-- To rollback this migration, run:
-- DROP TRIGGER IF EXISTS update_custom_views_updated_at ON custom_views;
-- DROP TRIGGER IF EXISTS update_view_folders_updated_at ON view_folders;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS custom_views CASCADE;
-- DROP TABLE IF EXISTS view_folders CASCADE;
