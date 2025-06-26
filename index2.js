const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
// Replace AWS SDK v2 with AWS SDK v3 imports
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { default: axios } = require('axios');

// Configure AWS SDK v3
const s3Client = new S3Client({
  region: 'eu-north-1', // Add your region
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

exports.createPdfs = (tasks, click = false, res) => {
  // Return a promise that can be awaited
  return new Promise((resolve, reject) => {
    try {
      // Validate input
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        const error = new Error("No valid tasks provided");
        if (res) res.status(400).json({ error: error.message });
        return reject(error);
      }

      const employeeTasks = {};
      
      // Group tasks by employee
      tasks.forEach(task => {
        if (!employeeTasks[task.assigned_to]) {
          employeeTasks[task.assigned_to] = [];
        }
        employeeTasks[task.assigned_to].push(task);
      });

      if (Object.keys(employeeTasks).length === 0) {
        const error = new Error("No valid tasks with assigned_to field");
        if (res) res.status(400).json({ error: error.message });
        return reject(error);
      }

      // Prepare to track PDF files
      const filePromises = [];
      const createdFiles = [];

      // Create PDF for each employee
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
        const filePromise = new Promise((fileResolve, fileReject) => {
          writeStream.on('finish', () => {
            console.log(`Created: ${filename}`);
            fileResolve();
          });
          writeStream.on('error', fileReject);
        });

        filePromises.push(filePromise);

        // Basic PDF content - simplified for reliability
        pdfDoc.fontSize(24)
          .font('Helvetica-Bold')
          .text('Task Report', {
            align: 'center'
          });

        pdfDoc.moveDown(1);
        
        pdfDoc.fontSize(16)
          .font('Helvetica-Bold')
          .text(`Tasks for: ${employeeName}`, {
            align: 'left'
          });

        pdfDoc.moveDown(1);

        // Group tasks by due date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Add each task as a simple list item
        employeeTasksList.forEach((task, index) => {
          const dueDate = new Date(task.due_date);
          let dateStatus = "UPCOMING";
          
          if (dueDate < today) {
            dateStatus = "OVERDUE";
          } else if (dueDate.toDateString() === today.toDateString()) {
            dateStatus = "DUE TODAY";
          }
          
          pdfDoc.fontSize(12)
            .font('Helvetica-Bold')
            .fillColor(dateStatus === "OVERDUE" ? "#FF0000" : dateStatus === "DUE TODAY" ? "#FFA500" : "#000000")
            .text(`Task ${index + 1}: ${task.task_name} (${dateStatus})`, {
              continued: false
            });
          
          pdfDoc.fontSize(10)
            .font('Helvetica')
            .fillColor("#000000")
            .text(`Due Date: ${dueDate.toLocaleDateString()}`, {
              continued: false
            });
            
          pdfDoc.fontSize(10)
            .font('Helvetica')
            .text(`Priority: ${task.priority || 'Not specified'}`, {
              continued: false
            });
            
          pdfDoc.fontSize(10)
            .font('Helvetica')
            .text(`Notes: ${task.notes || 'None'}`, {
              continued: false
            });
            
          pdfDoc.moveDown(1);
        });

        // End the PDF
        pdfDoc.end();
      }

      // Wait for all PDFs to be created
      Promise.all(filePromises)
        .then(async () => {
          try {
            // Upload first file to S3
            if (createdFiles.length === 0) throw new Error("No PDF files created");
            
            const filename = createdFiles[0];
            const fileContent = fs.readFileSync(filename);
            const s3Key = `employee-tasks/${path.basename(filename)}`;

            const params = {
              Bucket: process.env.S3_BUCKET_NAME,
              Key: s3Key,
              Body: fileContent,
              ContentType: 'application/pdf',
            };

            // Upload the file
            const command = new PutObjectCommand(params);
            await s3Client.send(command);
            console.log(`Uploaded ${filename} to S3: ${s3Key}`);

            // Generate a signed URL
            const getCommand = new GetObjectCommand({
              Bucket: process.env.S3_BUCKET_NAME,
              Key: s3Key
            });

            const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 259200 }); // 3 days
            console.log(`Generated signed URL: ${url}`);

            // Handle different response scenarios
            if (res) {
              // If click=true, redirect to a download endpoint
              if (click) {
                return res.redirect(`/download-pdf?url=${encodeURIComponent(url)}`);
              } else {
                return res.json({ downloadUrl: url });
              }
            }

            // Clean up files
            createdFiles.forEach(file => {
              try {
                fs.unlinkSync(file);
              } catch (e) {
                console.error(`Error deleting file ${file}:`, e.message);
              }
            });

            // Resolve the promise with the URL
            resolve({ downloadUrl: url });
          } catch (error) {
            console.error("Error processing PDFs:", error.message);
            
            if (res && !res.headersSent) {
              res.status(500).json({ error: "Error generating PDF" });
            }
            
            // Clean up any created files
            createdFiles.forEach(file => {
              try {
                if (fs.existsSync(file)) fs.unlinkSync(file);
              } catch (e) {}
            });
            
            reject(error);
          }
        })
        .catch(error => {
          console.error("Error creating PDFs:", error.message);
          
          if (res && !res.headersSent) {
            res.status(500).json({ error: "Error creating PDF files" });
          }
          
          // Clean up any created files
          createdFiles.forEach(file => {
            try {
              if (fs.existsSync(file)) fs.unlinkSync(file);
            } catch (e) {}
          });
          
          reject(error);
        });
    } catch (error) {
      console.error("Error in createPdfs:", error.message);
      
      if (res && !res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
      
      reject(error);
    }
  });
};
