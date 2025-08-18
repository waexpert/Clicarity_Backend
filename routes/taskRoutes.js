const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const {
  createTask,
  processTasks,
  discoverTaskTables,
  handleGeneratePdf,
  handleDownloadPdf
} = require('../utils/taskService');

// Validation middleware for task creation
const validateTaskCreation = [
  body('task_name').notEmpty().withMessage('Task name is required'),
  body('assigned_to').notEmpty().withMessage('Assigned to is required'),
  body('assigned_by').notEmpty().withMessage('Assigned by is required'),
  body('due_date').isISO8601().withMessage('Valid due date is required'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('status').optional().isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid status'),
];

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Create a new task
router.post('/create', validateTaskCreation, handleValidationErrors, async (req, res) => {
  try {
    const result = await createTask(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('❌ Error creating task:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Process tasks manually
router.post('/process', async (req, res) => {
  try {
    const { all_schemas = true } = req.body;
    const result = await processTasks(all_schemas);
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error processing tasks:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Discover task tables across schemas
router.get('/discover-tables', async (req, res) => {
  try {
    const tables = await discoverTaskTables();
    res.status(200).json({
      message: 'Task tables discovered successfully',
      tables,
      count: tables.length
    });
  } catch (error) {
    console.error('❌ Error discovering task tables:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Generate PDF for tasks
router.get('/generate-pdf', handleGeneratePdf);

// Download PDF
router.get('/download-pdf', handleDownloadPdf);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'task-service',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

