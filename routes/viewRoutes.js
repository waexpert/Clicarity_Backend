/**
 * View Routes
 * Handles all CRUD operations for database views
 * Includes Looker Studio integration support
 */

const express = require('express');
const router = express.Router();
const pool = require('../database/databaseConnection.js');

/**
 * GET /api/views/tables
 * Get all available tables with their columns from the database
 * This is used in the CreateView component to show available tables
 */
router.get('/tables', async (req, res) => {
  try {
    const schemaName = req.query.schemaName || 'public';

    // Query to get all tables and their columns from PostgreSQL information_schema
    const tablesQuery = `
      SELECT
        t.table_name,
        json_agg(
          json_build_object(
            'name', c.column_name,
            'type', c.data_type
          ) ORDER BY c.ordinal_position
        ) as columns
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c
        ON t.table_name = c.table_name
        AND t.table_schema = c.table_schema
      WHERE t.table_schema = $1
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE 'pg_%'
        AND t.table_name NOT LIKE 'sql_%'
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `;

    const result = await pool.query(tablesQuery, [schemaName]);

    // Format the response
    const tables = result.rows.map(row => ({
      name: row.table_name,
      columns: row.columns || []
    }));

    res.json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({
      error: 'Failed to fetch tables',
      message: error.message
    });
  }
});

/**
 * GET /api/views/team-members
 * Get all team members for access control
 */
router.get('/team-members', async (req, res) => {
  try {
    const schemaName = req.query.schemaName || 'public';

    const query = `
      SELECT id, name, email
      FROM ${schemaName}.users
      WHERE is_active = true
      ORDER BY name;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({
      error: 'Failed to fetch team members',
      message: error.message
    });
  }
});

/**
 * GET /api/views/folders
 * Get all view folders with their views
 */
router.get('/folders', async (req, res) => {
  try {
    const schemaName = req.query.schemaName || 'public';

    // Get all folders with their views
    const query = `
      SELECT
        f.id as folder_id,
        f.name as folder_name,
        json_agg(
          json_build_object(
            'id', v.id,
            'name', v.name,
            'sql_view_name', v.sql_view_name,
            'description', v.description,
            'column_count', array_length(v.selected_columns, 1),
            'last_modified', v.updated_at
          ) ORDER BY v.updated_at DESC
        ) FILTER (WHERE v.id IS NOT NULL) as views
      FROM ${schemaName}.view_folders f
      LEFT JOIN ${schemaName}.custom_views v ON f.id = v.folder_id
      GROUP BY f.id, f.name
      ORDER BY f.name;
    `;

    const result = await pool.query(query);

    const folders = result.rows.map(row => ({
      id: row.folder_id,
      name: row.folder_name,
      views: row.views || []
    }));

    res.json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({
      error: 'Failed to fetch folders',
      message: error.message
    });
  }
});

/**
 * GET /api/views/:id
 * Get a specific view by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schemaName = req.query.schemaName || 'public';

    const query = `
      SELECT * FROM ${schemaName}.custom_views
      WHERE id = $1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'View not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching view:', error);
    res.status(500).json({
      error: 'Failed to fetch view',
      message: error.message
    });
  }
});

/**
 * POST /api/views
 * Create a new database view
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      name,
      sql_view_name,
      description,
      folder,
      selected_tables,
      selected_columns,
      joins,
      where_conditions,
      team_members,
      sql
    } = req.body;

    const schemaName = req.query.schemaName || 'public';

    // 1. Get or create folder
    let folderId;
    const folderQuery = `
      INSERT INTO ${schemaName}.view_folders (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `;
    const folderResult = await client.query(folderQuery, [folder || 'Default']);
    folderId = folderResult.rows[0].id;

    // 2. Create the PostgreSQL view
    await client.query(sql);

    // 3. Save view metadata
    const insertQuery = `
      INSERT INTO ${schemaName}.custom_views (
        name,
        sql_view_name,
        description,
        folder_id,
        selected_tables,
        selected_columns,
        joins,
        where_conditions,
        team_members,
        sql,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *;
    `;

    const result = await client.query(insertQuery, [
      name,
      sql_view_name,
      description,
      folderId,
      JSON.stringify(selected_tables),
      JSON.stringify(selected_columns),
      JSON.stringify(joins),
      JSON.stringify(where_conditions),
      JSON.stringify(team_members),
      sql
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'View created successfully',
      view: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating view:', error);
    res.status(500).json({
      error: 'Failed to create view',
      message: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/views/:id
 * Update an existing view
 */
router.put('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      name,
      sql_view_name,
      description,
      folder,
      selected_tables,
      selected_columns,
      joins,
      where_conditions,
      team_members,
      sql
    } = req.body;

    const schemaName = req.query.schemaName || 'public';

    // 1. Get or create folder
    let folderId;
    const folderQuery = `
      INSERT INTO ${schemaName}.view_folders (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `;
    const folderResult = await client.query(folderQuery, [folder || 'Default']);
    folderId = folderResult.rows[0].id;

    // 2. Update the PostgreSQL view (CREATE OR REPLACE)
    await client.query(sql);

    // 3. Update view metadata
    const updateQuery = `
      UPDATE ${schemaName}.custom_views
      SET
        name = $1,
        sql_view_name = $2,
        description = $3,
        folder_id = $4,
        selected_tables = $5,
        selected_columns = $6,
        joins = $7,
        where_conditions = $8,
        team_members = $9,
        sql = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      name,
      sql_view_name,
      description,
      folderId,
      JSON.stringify(selected_tables),
      JSON.stringify(selected_columns),
      JSON.stringify(joins),
      JSON.stringify(where_conditions),
      JSON.stringify(team_members),
      sql,
      id
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'View not found' });
    }

    await client.query('COMMIT');

    res.json({
      message: 'View updated successfully',
      view: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating view:', error);
    res.status(500).json({
      error: 'Failed to update view',
      message: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/views/:id
 * Delete a view
 */
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const schemaName = req.query.schemaName || 'public';

    // 1. Get view details
    const getViewQuery = `
      SELECT sql_view_name FROM ${schemaName}.custom_views
      WHERE id = $1;
    `;
    const viewResult = await client.query(getViewQuery, [id]);

    if (viewResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'View not found' });
    }

    const sqlViewName = viewResult.rows[0].sql_view_name;

    // 2. Drop the PostgreSQL view
    await client.query(`DROP VIEW IF EXISTS ${schemaName}.${sqlViewName};`);

    // 3. Delete metadata
    const deleteQuery = `
      DELETE FROM ${schemaName}.custom_views
      WHERE id = $1;
    `;
    await client.query(deleteQuery, [id]);

    await client.query('COMMIT');

    res.json({ message: 'View deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting view:', error);
    res.status(500).json({
      error: 'Failed to delete view',
      message: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/views/preview
 * Preview view data before saving
 */
router.post('/preview', async (req, res) => {
  try {
    const { sql } = req.body;
    const schemaName = req.query.schemaName || 'public';

    // Extract the SELECT portion from CREATE VIEW statement
    const selectMatch = sql.match(/SELECT[\s\S]*?(?=;|$)/i);
    if (!selectMatch) {
      return res.status(400).json({ error: 'Invalid SQL statement' });
    }

    const selectQuery = selectMatch[0] + ' LIMIT 100';

    const result = await pool.query(selectQuery);
    res.json(result.rows);

  } catch (error) {
    console.error('Error previewing view:', error);
    res.status(500).json({
      error: 'Failed to preview view',
      message: error.message
    });
  }
});

/**
 * GET /api/views/:id/looker-studio
 * Get Looker Studio connection details for a view
 */
router.get('/:id/looker-studio', async (req, res) => {
  try {
    const { id } = req.params;
    const schemaName = req.query.schemaName || 'public';

    const query = `
      SELECT
        sql_view_name,
        name,
        description
      FROM ${schemaName}.custom_views
      WHERE id = $1;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'View not found' });
    }

    const view = result.rows[0];

    // Return connection details for Looker Studio
    res.json({
      view_name: view.sql_view_name,
      display_name: view.name,
      description: view.description,
      connection_info: {
        type: 'PostgreSQL',
        database: process.env.PGDATABASE || 'your_database',
        schema: schemaName,
        table: view.sql_view_name,
        instructions: `
To connect this view to Looker Studio:
1. In Looker Studio, click "Create" > "Data Source"
2. Select "PostgreSQL" as the connector
3. Enter the following connection details:
   - Host: ${process.env.PGHOST || 'your_host'}
   - Port: ${process.env.PGPORT || '5432'}
   - Database: ${process.env.PGDATABASE || 'your_database'}
   - Schema: ${schemaName}
   - Table: ${view.sql_view_name}
4. Authenticate with your database credentials
5. Click "Connect" and start building your reports!
        `.trim()
      }
    });

  } catch (error) {
    console.error('Error getting Looker Studio details:', error);
    res.status(500).json({
      error: 'Failed to get Looker Studio details',
      message: error.message
    });
  }
});

module.exports = router;
