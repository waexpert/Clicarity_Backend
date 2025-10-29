const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');


const pool = require("./database/databaseConnection.js");
const app = express();
app.use(express.json());


// PDF Configuration
const getPDFConfig = () => ({
    pageMargin: 50,
    pageWidth: 612 - (2 * 50),
    priorityColors: {
        'High': '#FFE4E1',
        'Medium': '#E6F3FF',
        'Low': '#F0FFF0'
    },
    tableConfig: {
        columns: [
            { name: 'Task Name', width: 100 },
            { name: 'Description', width: 120 },
            { name: 'Remarks', width: 100 },
            { name: 'Attachments', width: 80 },
            { name: 'Due Date', width: 70 },
            { name: 'Mark Done', width: 70 }
        ],
        rowHeight: 35,
        headerHeight: 25,
        fontSize: 9,
        headerFontSize: 10
    }
});

// Format date to short format (e.g., "Mon May 05")
const formatShortDate = (date) => {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return date.toString();
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${days[d.getDay()]} ${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
};

// Add company header to PDF
const addHeader = (doc, config) => {
    doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('Company Name', {
            align: 'center'
        });
    
    doc.moveDown(1);
    return doc.y;
};

// Add greeting section to PDF
const addGreeting = (doc, email, currentDate, config) => {
    doc
        .fontSize(11)
        .font('Helvetica')
        .text(`Dear ${email},`, {
            align: 'left'
        });
    
    doc.moveDown(0.5);
    
    doc
        .fontSize(10)
        .text(`This document provides a summary of your tasks as of ${currentDate}, organized by due date and priority. Please review your tasks and their status to manage your workload effectively. You can click on "Click Here" to mark tasks as complete.`, {
            align: 'left',
            width: config.pageWidth
        });
    
    doc.moveDown(1.5);
    return doc.y;
};

// Categorize tasks by due date
const categorizeTasks = (tasks) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const categorized = {
        overdue: [],
        dueToday: [],
        dueLater: []
    };
    
    tasks.forEach(task => {
        if (task.status && task.status.toLowerCase() === 'completed') {
            return; // Skip completed tasks
        }
        
        const dueDate = new Date(task.dueDate || task.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
            categorized.overdue.push(task);
        } else if (dueDate.getTime() === today.getTime()) {
            categorized.dueToday.push(task);
        } else {
            categorized.dueLater.push(task);
        }
    });
    
    // Sort each category by priority
    const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
    
    Object.keys(categorized).forEach(key => {
        categorized[key].sort((a, b) => {
            const priorityA = priorityOrder[a.priority] || 4;
            const priorityB = priorityOrder[b.priority] || 4;
            return priorityA - priorityB;
        });
    });
    
    return categorized;
};

// Group tasks by priority
const groupByPriority = (tasks) => {
    const grouped = {};
    
    tasks.forEach(task => {
        const priority = task.priority || 'Low';
        if (!grouped[priority]) {
            grouped[priority] = [];
        }
        grouped[priority].push(task);
    });
    
    return grouped;
};

// Draw text in table cell
const drawCellText = (doc, text, x, y, width, tableConfig) => {
    const textY = y + 10; // Vertical padding
    
    doc.text(text, x + 3, textY, {
        width: width - 6,
        align: 'left',
        ellipsis: true,
        lineBreak: false
    });
};

// Draw table row
const drawTableRow = (doc, task, index, startX, currentY, config, tableConfig) => {
    let currentX = startX;
    
    // Check if we need a new page
    if (currentY + tableConfig.rowHeight > 700) {
        doc.addPage();
        currentY = config.pageMargin;
    }
    
    // Row border
    doc
        .rect(startX, currentY, config.pageWidth, tableConfig.rowHeight)
        .stroke('#CCCCCC');
    
    // Reset text settings
    doc
        .fillColor('black')
        .fontSize(tableConfig.fontSize)
        .font('Helvetica');
    
    // Support both camelCase and snake_case column names
    const taskName = task.taskName || task.task_name || '';
    const description = task.description || 'Please prioritize this task.';
    const remarks = task.remarks || 'Waiting for approval';
    const attachmentUrl = task.attachmentUrl || task.attachment_url;
    const dueDate = task.dueDate || task.due_date;
    const webhookUrl = task.webhookUrl || task.webhook_url || `https://example.com/complete?uid=${task.uid || task.id}`;
    
    // Task Name
    drawCellText(doc, taskName, currentX, currentY, tableConfig.columns[0].width, tableConfig);
    currentX += tableConfig.columns[0].width;
    
    // Description
    drawCellText(doc, description, currentX, currentY, tableConfig.columns[1].width, tableConfig);
    currentX += tableConfig.columns[1].width;
    
    // Remarks
    drawCellText(doc, remarks, currentX, currentY, tableConfig.columns[2].width, tableConfig);
    currentX += tableConfig.columns[2].width;
    
    // Attachments
    if (attachmentUrl) {
        doc
            .fillColor('#0066CC')
            .font('Helvetica')
            .text('View File', currentX + 3, currentY + 10, {
                width: tableConfig.columns[3].width - 6,
                align: 'center',
                link: attachmentUrl
            });
    }
    currentX += tableConfig.columns[3].width;
    
    // Due Date
    doc
        .fillColor('black')
        .font('Helvetica');
    drawCellText(doc, formatShortDate(dueDate), currentX, currentY, tableConfig.columns[4].width, tableConfig);
    currentX += tableConfig.columns[4].width;
    
    // Mark Done (Click Here link)
    doc
        .fillColor('#0066CC')
        .font('Helvetica')
        .text('Click Here', currentX + 3, currentY + 10, {
            width: tableConfig.columns[5].width - 6,
            align: 'center',
            link: webhookUrl,
            underline: true
        });
    
    return currentY + tableConfig.rowHeight;
};

// Draw table header
const drawTableHeader = (doc, color, startX, currentY, config, tableConfig) => {
    let currentX = startX;
    
    // Header background
    doc
        .rect(startX, currentY, config.pageWidth, tableConfig.headerHeight)
        .fill(color)
        .stroke('#CCCCCC');
    
    // Header text
    doc
        .fillColor('black')
        .fontSize(tableConfig.headerFontSize)
        .font('Helvetica-Bold');
    
    tableConfig.columns.forEach(column => {
        doc.text(
            column.name,
            currentX + 3,
            currentY + 5,
            {
                width: column.width - 6,
                align: 'left'
            }
        );
        currentX += column.width;
    });
    
    return currentY + tableConfig.headerHeight;
};

// Draw table for tasks
const drawTable = (doc, priority, tasks, startX, currentY, config) => {
    const tableConfig = config.tableConfig;
    const headerColor = config.priorityColors[priority];
    
    // Draw header
    currentY = drawTableHeader(doc, headerColor, startX, currentY, config, tableConfig);
    
    // Draw rows
    tasks.forEach((task, index) => {
        currentY = drawTableRow(doc, task, index, startX, currentY, config, tableConfig);
    });
    
    return currentY;
};

// Add priority section with table
const addPrioritySection = (doc, priority, tasks, currentY, config) => {
    const tableConfig = config.tableConfig;
    
    // Check if we need a new page
    const estimatedHeight = 30 + (tasks.length * tableConfig.rowHeight);
    if (currentY + estimatedHeight > 700) {
        doc.addPage();
        currentY = config.pageMargin;
    }
    
    // Priority heading
    doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text(`${priority} Priority`, config.pageMargin, currentY);
    
    currentY += 20;
    
    // Draw table
    currentY = drawTable(doc, priority, tasks, config.pageMargin, currentY, config);
    
    // Add spacing after table
    currentY += 20;
    
    return currentY;
};

// Add a section (OVERDUE, DUE TODAY, DUE LATER)
const addSection = (doc, sectionTitle, tasks, email, currentY, config) => {
    if (tasks.length === 0) return currentY;
    
    // Section header
    doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#000080') // Dark blue for section titles
        .text(sectionTitle, config.pageMargin, currentY);
    
    doc.moveDown(0.5);
    currentY = doc.y;
    
    // Tasks for: email
    doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('black')
        .text(`Tasks for: ${email}`, config.pageMargin, currentY);
    
    doc.moveDown(1);
    currentY = doc.y;
    
    // Group tasks by priority
    const tasksByPriority = groupByPriority(tasks);
    
    // Add tables for each priority
    ['High', 'Medium', 'Low'].forEach(priority => {
        if (tasksByPriority[priority] && tasksByPriority[priority].length > 0) {
            currentY = addPrioritySection(doc, priority, tasksByPriority[priority], currentY, config);
        }
    });
    
    return currentY;
};

// Create PDF and stream directly to response
const createPdfs = (tasks, res, assignedTo) => {
    try {
        const config = getPDFConfig();
        
        // Prepare employee data
        const employeeData = {
            name: assignedTo,
            email: assignedTo,
            date: new Date().toLocaleDateString('en-US'),
            tasks: tasks
        };
        
        // Create new PDF document
        const doc = new PDFDocument({ 
            margin: config.pageMargin,
            size: 'letter'
        });
        
        // Set response headers
        const fileName = `${assignedTo.replace(/[^a-zA-Z0-9]/g, '-')}-tasks-${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        // Pipe PDF directly to response
        doc.pipe(res);
        
        // Add header
        let currentY = addHeader(doc, config);
        
        // Add greeting and summary
        currentY = addGreeting(doc, employeeData.email || employeeData.name, employeeData.date, config);
        
        // Categorize tasks
        const categorizedTasks = categorizeTasks(employeeData.tasks);
        
        // Add sections
        if (categorizedTasks.overdue.length > 0) {
            currentY = addSection(doc, 'OVERDUE', categorizedTasks.overdue, employeeData.email || employeeData.name, currentY, config);
        }
        
        if (categorizedTasks.dueToday.length > 0) {
            currentY = addSection(doc, 'DUE TODAY', categorizedTasks.dueToday, employeeData.email || employeeData.name, currentY, config);
        }
        
        if (categorizedTasks.dueLater.length > 0) {
            currentY = addSection(doc, 'DUE LATER', categorizedTasks.dueLater, employeeData.email || employeeData.name, currentY, config);
        }
        
        // Finalize PDF
        doc.end();
        
    } catch (error) {
        console.error('Error creating PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to create PDF',
                message: error.message
            });
        }
    }
};

// API Endpoint to generate task report
app.get('/generatePdf', async (req, res) => {
    try {
        const { schemaName, tableName, assignedTo } = req.query;
        
        // Validate required parameters
        if (!tableName || !assignedTo) {
            return res.status(400).json({
                error: 'Missing required parameters: tableName and assignedTo are required'
            });
        }
        
        // Check if pool is initialized
        if (!pool) {
            return res.status(400).json({
                error: 'Database pool not initialized. Please call /api/init-db first or set environment variables.'
            });
        }
        
        // Build and execute query
        const schema = schemaName || 'public';
        const query = `
            SELECT * FROM ${schema}.${tableName} 
            WHERE assigned_to = '${assignedTo}'
            ORDER BY due_date ASC
        `;
        
        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'No tasks found for the specified user',
                assignedTo
            });
        }
        
        // Create and stream PDF
        createPdfs(result.rows, res, assignedTo);
        
    } catch (error) {
        console.error('Error generating report:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to generate report',
                message: error.message
            });
        }
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Task Report API is running' });
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Task Report API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Generate PDF: GET http://localhost:${PORT}/generatePdf?schemaName=public&tableName=tasks&assignedTo=user@example.com`);
});

module.exports = { app, createPdfs };