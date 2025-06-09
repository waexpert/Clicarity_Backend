const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AWS = require('aws-sdk');

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: 'AKIASREQRA5PES4X3U6A',
  secretAccessKey: '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',
});

// Read tasks from tasks.json
//const tasks = require('./tasks.json');

exports.createPdfs = (tasks, res) => {
  const employeeTasks = {};
  // Get current date for comparison
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  // Group tasks by employee
  tasks.forEach(task => {
    if (!employeeTasks[task.assigned_to]) {
      employeeTasks[task.assigned_to] = [];
    }
    employeeTasks[task.assigned_to].push(task);
  });

  // Track when all PDFs are created
  const filePromises = [];
  const createdFiles = [];
  
  // Create a PDF for each employee
  for (const employeeName in employeeTasks) {
    const employeeTasksList = employeeTasks[employeeName];
    const pdfDoc = new PDFDocument({
      margin: 20,
      size: 'A4',
      layout: 'portrait'
    });
    const filename = `${employeeName.replace(/\s+/g, '_')}_Tasks.pdf`;
    createdFiles.push(filename);
    
    const writeStream = fs.createWriteStream(filename);
    pdfDoc.pipe(writeStream);
    
    // Create a promise for each file being written
    const filePromise = new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log(`Created: ${filename}`);
        resolve();
      });
      writeStream.on('error', reject);
    });
    
    filePromises.push(filePromise);

    // Function to draw table headers with priority color
    const drawTableHeaders = (priority) => {
      const headers = ['Task Name','Description', 'Remarks',  'Attachments', 'Due Date','Mark Done'];
      const colWidths = [120, 120, 120, 70, 60, 70]; // Reduced widths
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      let x = 20; // Increased left margin
      let y = pdfDoc.y;

      // Draw header background
      pdfDoc.fillColor(priority === 'Low' ? '#C8E6C9' : priority === 'Medium' ? '#FFE082' : priority === 'High' ? '#FFCDD2' : '#808080')
        .rect(x, y, tableWidth, 30)
        .fill();

      // Draw header text in bold with center alignment
      headers.forEach((header, i) => {
        pdfDoc.fillColor('black')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(header, x, y + 10, {
            width: colWidths[i],
            align: 'center'
          })

        x += colWidths[i];
      });

      return { y: y + 30, colWidths, tableWidth };
    };

    // Function to draw a row with improved word wrapping
    const drawRow = (task, y, colWidths, tableWidth) => {
      let x = 20; // Match header left margin
      const rowHeight = 50;
      const rowData = [
        task.task_name,
        task.notes,
        task.pending_to_auditor_remarks || '',
        'View File',
        String(task.due_date).substring(0,10), 
      ];

      // Draw row background
      pdfDoc.fillColor('white')
        .rect(x, y, tableWidth, rowHeight)
        .fill();

      // Draw cell borders and content
      rowData.forEach((text, i) => {
        pdfDoc.strokeColor('#000000')
          .rect(x, y, colWidths[i], rowHeight)
          .stroke();

        if (i === 3 && task.task_file) { // Task File column
          pdfDoc.fillColor('#0000FF')
            .fontSize(10)
            .text('View File', x, y + 15, {
              width: colWidths[i],
              align: 'center',
              underline: true
            });
          pdfDoc.link(x, y, colWidths[i], rowHeight, task.task_file);
        } else {
          // Improved text wrapping with ellipsis for overflow
          pdfDoc.fillColor('black')
            .fontSize(9)
            .font('Helvetica')
            .text(text ? text.toString() : '', x + 5, y + 5, {
              width: colWidths[i] - 10,
              align: i === 0 ? 'center' : 'left',
              lineGap: 2,
              ellipsis: true,
              height: rowHeight - 10
            });
        }

        x += colWidths[i];
      });

      // Draw the "Click Here" cell with link
      pdfDoc.strokeColor('#000000')
        .rect(x, y, colWidths[5], rowHeight)
        .stroke();

      const markDoneUrl = `https://your-api-domain.com/mark-done?taskId=${task.task_id}&employeeName=${encodeURIComponent(employeeName)}`;
      pdfDoc.link(x, y, colWidths[5], rowHeight, markDoneUrl);
      pdfDoc.fillColor('#0000FF')
        .fontSize(10)
        .text('Click Here', x, y + 15, {
          width: colWidths[5],
          align: 'center',
          underline: true
        });

      return y + rowHeight;
    };

    // Update the drawTasksSectionByPriority function to use the same column widths
    const drawTasksSectionByPriority = (tasks, title) => {
      if (tasks.length === 0) return;

      // Calculate table width once at the start using the same widths as headers
      const colWidths = [120, 120, 120, 70, 60, 70]; // Match header widths
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);

      // Group tasks by priority
      const priorityGroups = {
        'High': tasks.filter(task => task.priority === 'High'),
        'Medium': tasks.filter(task => task.priority === 'Medium'),
        'Low': tasks.filter(task => task.priority === 'Low'),
        'Unspecified': tasks.filter(task => !task.priority)
      };

      // Draw each priority group
      Object.entries(priorityGroups).forEach(([priority, priorityTasks]) => {
        if (priorityTasks.length === 0) return;

        // Add page break if content would overflow
        if (pdfDoc.y > pdfDoc.page.height - 150) {
          pdfDoc.addPage();
          drawSectionTitle(`${title} (Continued)`);
          drawEmployeeName(employeeName);
        }

        // Draw priority header with consistent styling
        pdfDoc.fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#000000')
          .text(`${priority} Priority`, 25, pdfDoc.y, {
            align: 'left',
            width: tableWidth,
            continued: false
          });

        pdfDoc.moveDown(0.5);

        const { y, colWidths: headerColWidths } = drawTableHeaders(priority);
        let currentY = y;

        priorityTasks.forEach(task => {
          if (currentY > pdfDoc.page.height - 50) {
            pdfDoc.addPage();
            drawSectionTitle(`${title} (Continued)`);
            drawEmployeeName(employeeName);
            pdfDoc.fontSize(14)
              .font('Helvetica-Bold')
              .fillColor('#000000')
              .text(`${priority} Priority (Continued)`, 25, pdfDoc.y, {
                align: 'left',
                width: tableWidth,
                continued: false
              });
            pdfDoc.moveDown(0.5);
            const { y } = drawTableHeaders(priority);
            currentY = y;
          }
          currentY = drawRow(task, currentY, colWidths, tableWidth);
        });

        pdfDoc.moveDown(4.5);
      });
    };

    // Function to get latest due date
    const getLatestDueDate = (tasks) => {
      return tasks.reduce((latest, task) => {
        const dueDate = new Date(task.due_date);
        return dueDate > latest ? dueDate : latest;
      }, new Date(0));
    };

    // Function to draw company header
    const drawCompanyHeader = (employeeName, tasks) => {
      const latestDueDate = new Date();
      const formattedDate = latestDueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      pdfDoc.fontSize(24)
        .font('Helvetica-Bold')
        .text('Company Name', {
          align: 'center'
        });

      pdfDoc.moveDown(1);

      pdfDoc.fontSize(14)
        .font('Helvetica')
        .text(`Dear ${employeeName},`, {
          align: 'left'
        });

      pdfDoc.moveDown(0.5);

      pdfDoc.fontSize(12)
        .text(`This document provides a summary of your tasks as of ${formattedDate}, organized by due date and priority. Please review your tasks and their status to manage your workload effectively. You can click on "Click Here" to mark tasks as complete.`, {
          align: 'left',
          width: pdfDoc.page.width - 80,
          lineGap: 2
        });

      pdfDoc.moveDown(2);
    };

    // Add company header at the start
    drawCompanyHeader(employeeName, employeeTasksList);

    // Function to draw section title
    const drawSectionTitle = (title) => {
      pdfDoc.fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(title, {
          align: 'center'
        });

      pdfDoc.moveDown();
    };

    // Function to draw employee name
    const drawEmployeeName = (name) => {
      pdfDoc.fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(`Tasks for: ${name}`, {
          align: 'left'
        });

      pdfDoc.moveDown();
    };

    // Page 1: Overdue Tasks
    const overdueTasks = employeeTasksList.filter(task => {
      const dueDate = new Date(task.due_date);
      return dueDate < currentDate;
    });

    if (overdueTasks.length > 0) {
      drawSectionTitle('OVERDUE');
      drawEmployeeName(employeeName);
      drawTasksSectionByPriority(overdueTasks, 'OVERDUE');
    }

    // Page 2: Tasks Due Today
    const todayTasks = employeeTasksList.filter(task => {
      const dueDate = new Date(task.due_date);
      return dueDate.toDateString() === currentDate.toDateString();
    });

    if (todayTasks.length > 0) {
      if (overdueTasks.length > 0) pdfDoc.addPage();
      drawSectionTitle('DUE TODAY');
      drawEmployeeName(employeeName);
      drawTasksSectionByPriority(todayTasks, 'TODAY DUE');
    }

    // Page 3: Due Later Tasks (Tomorrow onwards)
    const tomorrowDate = new Date(currentDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    const laterTasks = employeeTasksList.filter(task => {
      const dueDate = new Date(task.due_date);
      return dueDate >= tomorrowDate;
    });

    if (laterTasks.length > 0) {
      if (overdueTasks.length > 0 || todayTasks.length > 0) pdfDoc.addPage();
      drawSectionTitle('DUE LATER');
      drawEmployeeName(employeeName);
      drawTasksSectionByPriority(laterTasks, 'DUE LATER');
    }

    pdfDoc.end();
  }
  
  // Wait for all PDFs to be created, then upload to S3 and send response
  Promise.all(filePromises)
    .then(() => {
      // Upload files to S3
      const s3UploadPromises = createdFiles.map(filename => {
        const fileContent = fs.readFileSync(filename);
        const s3Key = `employee-tasks/${path.basename(filename)}`;
        
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: s3Key,
          Body: fileContent,
          ContentType: 'application/pdf',
          // Set expiration time for the object (optional)
          // Expires: new Date(Date.now() + 3600 * 1000), // 1 hour
        };
        
        return s3.upload(params).promise()
          .then(data => {
            console.log(`Uploaded ${filename} to S3: ${data.Location}`);
            return {
              filename: filename,
              s3Location: data.Location,
              s3Key: s3Key
            };
          });
      });
      
      return Promise.all(s3UploadPromises);
    })
    .then(s3Results => {
      // If only one file was uploaded, generate a signed URL and redirect
      if (s3Results.length === 1) {
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: s3Results[0].s3Key,
          Expires: 60 * 5 // URL expires in 5 minutes
        };
        
        s3.getSignedUrl('getObject', params, (err, url) => {
          if (err) {
            console.error('Error generating signed URL:', err);
            return res.status(500).send('Error generating download link');
          }
          
          // Option 1: Redirect to the signed URL
          // res.redirect(url);
          
          // Option 2: Send the URL for the client to handle
          res.json({ downloadUrl: url });
          
          // Clean up local files
          fs.unlink(s3Results[0].filename, (err) => {
            if (err) console.error(`Error deleting ${s3Results[0].filename}:`, err);
          });
        });
      } else {
        // For multiple files, create a zip file locally first
        const zipFilename = 'employee_tasks.zip';
        const output = fs.createWriteStream(zipFilename);
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });
        
        output.on('close', () => {
          console.log(`Archive created: ${archive.pointer()} total bytes`);
          
          // Upload the zip file to S3
          const fileContent = fs.readFileSync(zipFilename);
          const s3Key = `employee-tasks/${zipFilename}`;
          
          const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: s3Key,
            Body: fileContent,
            ContentType: 'application/zip',
          };
          
          s3.upload(params).promise()
            .then(data => {
              console.log(`Uploaded ${zipFilename} to S3: ${data.Location}`);
              
              // Generate a signed URL for the zip file
              const signedParams = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: s3Key,
                Expires: 60 * 5 // URL expires in 5 minutes
              };
              
              s3.getSignedUrl('getObject', signedParams, (err, url) => {
                if (err) {
                  console.error('Error generating signed URL:', err);
                  return res.status(500).send('Error generating download link');
                }
                
                // Option 1: Redirect to the signed URL
                // res.redirect(url);
                
                // Option 2: Send the URL for the client to handle
                res.json({ downloadUrl: url });
                
                // Clean up local files
                fs.unlink(zipFilename, (err) => {
                  if (err) console.error(`Error deleting ${zipFilename}:`, err);
                });
                
                createdFiles.forEach(file => {
                  fs.unlink(file, (err) => {
                    if (err) console.error(`Error deleting ${file}:`, err);
                  });
                });
              });
            })
            .catch(err => {
              console.error('Error uploading zip to S3:', err);
              res.status(500).send('Error uploading files to storage');
            });
        });
        
        archive.on('error', (err) => {
          console.error('Archive error:', err);
          res.status(500).send('Error creating zip file');
        });
        
        archive.pipe(output);
        
        createdFiles.forEach(file => {
          archive.file(file, { name: path.basename(file) });
        });
        
        archive.finalize();
      }
    })
    .catch(err => {
      console.error('Error in PDF generation process:', err);
      res.status(500).send('Error creating PDF files');
    });
};
