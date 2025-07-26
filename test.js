// // pdf-preview-test.js - Standalone script to preview the aging report PDF
// const PDFDocument = require('pdfkit');
// const fs = require('fs');

// // Mock data that simulates your payment_reminders table
// const mockPaymentData = [
//   // 25 days overdue (0-30 bucket)
//   {
//     us_id: 'INV-2025-001',
//     amount: 75000,
//     due_date: '2024-06-23', // 25 days ago
//     payment_method: 'Bank Transfer',
//     status: 'pending',
//     days_overdue: 25
//   },
//   {
//     us_id: 'INV-2025-002', 
//     amount: 45000,
//     due_date: '2024-06-20', // 28 days ago
//     payment_method: 'UPI',
//     status: 'pending',
//     days_overdue: 28
//   },
  
//   // 45 days overdue (31-60 bucket)
//   {
//     us_id: 'INV-2025-003',
//     amount: 120000,
//     due_date: '2024-06-03', // 45 days ago
//     payment_method: 'Bank Transfer', 
//     status: 'pending',
//     days_overdue: 45
//   },
//   {
//     us_id: 'INV-2025-004',
//     amount: 80000,
//     due_date: '2024-05-30', // 49 days ago
//     payment_method: 'Cheque',
//     status: 'pending',
//     days_overdue: 49
//   },
  
//   // 75 days overdue (61-90 bucket)
//   {
//     us_id: 'INV-2025-005',
//     amount: 200000,
//     due_date: '2024-05-04', // 75 days ago
//     payment_method: 'Bank Transfer',
//     status: 'pending', 
//     days_overdue: 75
//   },
  
//   // 105 days overdue (91-120 bucket)
//   {
//     us_id: 'INV-2025-006',
//     amount: 150000,
//     due_date: '2024-04-04', // 105 days ago
//     payment_method: 'UPI',
//     status: 'pending',
//     days_overdue: 105
//   },
  
//   // 135 days overdue (121-150 bucket)
//   {
//     us_id: 'INV-2025-007',
//     amount: 300000,
//     due_date: '2024-03-05', // 135 days ago
//     payment_method: 'Bank Transfer',
//     status: 'pending',
//     days_overdue: 135
//   },
  
//   // 165 days overdue (151-180 bucket)
//   {
//     us_id: 'INV-2025-008',
//     amount: 90000,
//     due_date: '2024-02-03', // 165 days ago
//     payment_method: 'Cheque',
//     status: 'pending',
//     days_overdue: 165
//   }
// ];

// // Mock company information
// const mockCompanyInfo = {
//   from_company: 'ABC Technology Solutions Pvt Ltd',
//   send_to_company: 'XYZ Enterprises Limited',
//   send_to_name: 'Rajesh Kumar',
//   send_to_phone: '+91 98765 43210'
// };

// // Function to generate preview PDF
// async function generatePreviewPDF() {
//   try {
//     console.log('🎨 Generating PDF preview...');

//     // Categorize payments by aging buckets
//     const agingBuckets = {
//       past_30_days: { payments: [], total: 0, title: "0-30 Days Overdue" },
//       past_60_days: { payments: [], total: 0, title: "31-60 Days Overdue" },
//       past_90_days: { payments: [], total: 0, title: "61-90 Days Overdue" },
//       past_120_days: { payments: [], total: 0, title: "91-120 Days Overdue" },
//       past_150_days: { payments: [], total: 0, title: "121-150 Days Overdue" },
//       past_180_days: { payments: [], total: 0, title: "151-180 Days Overdue" }
//     };

//     let grandTotal = 0;

//     // Categorize each payment
//     mockPaymentData.forEach(payment => {
//       const amount = parseFloat(payment.amount) || 0;
//       grandTotal += amount;
      
//       if (payment.days_overdue <= 30) {
//         agingBuckets.past_30_days.payments.push(payment);
//         agingBuckets.past_30_days.total += amount;
//       } else if (payment.days_overdue <= 60) {
//         agingBuckets.past_60_days.payments.push(payment);
//         agingBuckets.past_60_days.total += amount;
//       } else if (payment.days_overdue <= 90) {
//         agingBuckets.past_90_days.payments.push(payment);
//         agingBuckets.past_90_days.total += amount;
//       } else if (payment.days_overdue <= 120) {
//         agingBuckets.past_120_days.payments.push(payment);
//         agingBuckets.past_120_days.total += amount;
//       } else if (payment.days_overdue <= 150) {
//         agingBuckets.past_150_days.payments.push(payment);
//         agingBuckets.past_150_days.total += amount;
//       } else if (payment.days_overdue <= 180) {
//         agingBuckets.past_180_days.payments.push(payment);
//         agingBuckets.past_180_days.total += amount;
//       }
//     });

//     // Generate filename
//     const filename = `Aging_Report_Preview_${Date.now()}.pdf`;
    
//     // Create PDF document
//     const pdfDoc = new PDFDocument({
//       margin: 30,
//       size: 'A4',
//       layout: 'portrait'
//     });
    
//     // Set up file writing
//     const writeStream = fs.createWriteStream(filename);
//     pdfDoc.pipe(writeStream);

//     // Header with logo and company info
//     const pageWidth = pdfDoc.page.width - 60; // Account for margins
    
//     // Company Logo (circular - black and white)
//     pdfDoc.circle(50, 50, 30)
//       .fillColor('black')
//       .fill();
    
//     pdfDoc.fillColor('white')
//       .fontSize(20)
//       .font('Helvetica-Bold')
//       .text(mockCompanyInfo.from_company.charAt(0), 35, 35, { width: 30, align: 'center' });
    
      
//     pdfDoc.moveDown(2);

//     // Company name and report title
//     pdfDoc.fillColor('black')
//       .fontSize(18)
//       .font('Helvetica-Bold')
//       .text(mockCompanyInfo.from_company, 100, 40);

//     // Report date (right aligned)
//     const currentDate = new Date().toLocaleDateString('en-IN', {
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric'
//     });
    
//     pdfDoc.fontSize(12)
//       .font('Helvetica')
//       .text(`Report Date: ${currentDate}`, pageWidth - 150, 45, { width: 150, align: 'right' });

//     // Report title (centered)
//     // pdfDoc.moveDown(2)
//     //   .fontSize(28)
//     //   .font('Helvetica-Bold')
//     //   .text('PAYMENT AGING REPORT', { align: 'center' });

//     pdfDoc.moveDown(5);

//     // Recipient info box (black border only)
//     const recipientY = pdfDoc.y;
//     pdfDoc.rect(30, recipientY, pageWidth, 60)
//       .strokeColor('black')
//       .lineWidth(.5)
//       .stroke();

//     pdfDoc.fillColor('black')
//       .fontSize(14)
//       .font('Helvetica-Bold')
//       .text('Outstanding Payments For:', 40, recipientY + 10);

//     pdfDoc.fontSize(12)
//       .font('Helvetica')
//       .text(`Company: ${mockCompanyInfo.send_to_company}`, 40, recipientY + 30)
//       .text(`Contact: ${mockCompanyInfo.send_to_name}`, 40, recipientY + 45)
//       .text(`Phone: ${mockCompanyInfo.send_to_phone}`, 300, recipientY + 45);

//     pdfDoc.moveDown(2);

//     // Summary section (black and white boxes)
//     const summaryY = pdfDoc.y;
//     const cardWidth = (pageWidth - 20) / 2;
    
//     // Total Outstanding box
//     pdfDoc.rect(30, summaryY, cardWidth, 50)
//       .strokeColor('black')
//       .lineWidth(2)
//       .stroke();
    
//     pdfDoc.fillColor('black')
//       .fontSize(12)
//       .font('Helvetica-Bold')
//       .text('TOTAL OUTSTANDING', 40, summaryY + 10);
    
//     pdfDoc.fontSize(18)
//       .font('Helvetica-Bold')
//       .text(`₹${grandTotal.toLocaleString('en-IN')}`, 40, summaryY + 25);

//     // Invoice count box
//     pdfDoc.rect(50 + cardWidth, summaryY, cardWidth, 50)
//       .strokeColor('black')
//       .lineWidth(2)
//       .stroke();
    
//     pdfDoc.fillColor('black')
//       .fontSize(12)
//       .font('Helvetica-Bold')
//       .text('TOTAL INVOICES', 60 + cardWidth, summaryY + 10);
    
//     pdfDoc.fontSize(18)
//       .font('Helvetica-Bold')
//       .text(`${mockPaymentData.length} Invoices`, 60 + cardWidth, summaryY + 25);

//     pdfDoc.moveDown(3);

//     // Urgent notice (black border if total is high)
//     // if (grandTotal > 100000) {
//     //   pdfDoc.rect(30, pdfDoc.y, pageWidth, 30)
//     //     .strokeColor('black')
//     //     .lineWidth(2)
//     //     .stroke();
      
//     //   pdfDoc.fillColor('black')
//     //     .fontSize(14)
//     //     .font('Helvetica-Bold')
//     //     .text('URGENT: Total outstanding amount exceeds ₹1,00,000. Immediate action required.', 40, pdfDoc.y + 8, { align: 'center' });
      
//     //   pdfDoc.moveDown(1);
//     // }

//     // Generate tables for each aging bucket
//     Object.keys(agingBuckets).forEach((bucketKey, index) => {
//       const bucket = agingBuckets[bucketKey];
      
//       // Add new page if needed (except for first table)
//       if (index > 0 && pdfDoc.y > 650) {
//         pdfDoc.addPage();
//       }

//       // Bucket header (black background)
//       const headerY = pdfDoc.y;
//       pdfDoc.rect(30, headerY, pageWidth, 40)
//         .fillColor('black')
//         .fill();

//       pdfDoc.fillColor('white')
//         .fontSize(16)
//         .font('Helvetica-Bold')
//         .text(`${bucket.title} (${bucket.payments.length} invoice${bucket.payments.length !== 1 ? 's' : ''})`, 40, headerY + 8);

//       pdfDoc.fontSize(14)
//         .text(`₹${bucket.total.toLocaleString('en-IN')}`, pageWidth - 120, headerY + 8, { width: 100, align: 'right' });

//       pdfDoc.moveDown(0.5);

//       if (bucket.payments.length > 0) {
//         // Table headers (black background)
//         const tableY = pdfDoc.y;
//         const colWidths = [100, 80, 80, 60, 100, 80]; // Column widths
//         let currentX = 30;

//         // Header background (black)
//         pdfDoc.rect(30, tableY, pageWidth, 25)
//           .fillColor('black')
//           .fill();

//         // Header text (white on black)
//         const headers = ['Invoice ID', 'Amount', 'Due Date', 'Days Overdue', 'Payment Method', 'Status'];
//         pdfDoc.fillColor('white')
//           .fontSize(10)
//           .font('Helvetica-Bold');

//         headers.forEach((header, i) => {
//           pdfDoc.text(header, currentX + 5, tableY + 8, { width: colWidths[i] - 10, align: 'left' });
//           currentX += colWidths[i];
//         });

//         pdfDoc.moveDown(0.3);

//         // Table rows (simple alternating pattern)
//         bucket.payments.forEach((payment, rowIndex) => {
//           const rowY = pdfDoc.y;
//           currentX = 30;

//           // Simple alternating row pattern - no colors, just border
//           pdfDoc.rect(30, rowY, pageWidth, 20)
//             .strokeColor('black')
//             .lineWidth(0.5)
//             .stroke();

//           // Row data
//           const rowData = [
//             payment.us_id,
//             `₹${parseFloat(payment.amount).toLocaleString('en-IN')}`,
//             new Date(payment.due_date).toLocaleDateString('en-IN'),
//             `${payment.days_overdue} days`,
//             payment.payment_method,
//             payment.status.toUpperCase()
//           ];

//           pdfDoc.fillColor('black')
//             .fontSize(9)
//             .font('Helvetica');

//           rowData.forEach((data, i) => {
//             const align = i === 1 ? 'right' : 'left'; // Right align amount
//             pdfDoc.text(data, currentX + 5, rowY + 6, { 
//               width: colWidths[i] - 10, 
//               align: align,
//               ellipsis: true 
//             });
//             currentX += colWidths[i];
//           });

//           pdfDoc.moveDown(0.25);
//         });
//       } else {
//         // No data message (simple box)
//         pdfDoc.rect(30, pdfDoc.y, pageWidth, 40)
//           .strokeColor('black')
//           .lineWidth(1)
//           .stroke();

//         pdfDoc.fillColor('black')
//           .fontSize(12)
//           .font('Helvetica')
//           .text('No overdue payments in this category', 40, pdfDoc.y + 15, { align: 'center' });
//       }

//       pdfDoc.moveDown(1);
//     });

//     // Footer (simple black line separator)
//     if (pdfDoc.y > 700) {
//       pdfDoc.addPage();
//     }

//     pdfDoc.rect(30, pdfDoc.y, pageWidth, 2)
//       .fillColor('black')
//       .fill();

//     pdfDoc.moveDown(1);

//     pdfDoc.fillColor('black')
//       .fontSize(12)
//       .font('Helvetica-Bold')
//       .text('Payment Instructions:', { align: 'center' });

//     pdfDoc.fontSize(10)
//       .font('Helvetica')
//       .text('Please settle the above outstanding amounts at the earliest to avoid any service disruption.', { align: 'center' })
//       .text(`For any queries, please contact: ${mockCompanyInfo.from_company}`, { align: 'center' })
//       .text(`This is an automatically generated report on ${currentDate}`, { align: 'center' });

//     // End the PDF creation
//     pdfDoc.end();

//     // Wait for the PDF to be written
//     await new Promise((resolve, reject) => {
//       writeStream.on('finish', resolve);
//       writeStream.on('error', reject);
//     });

//     console.log(`✅ PDF preview created: ${filename}`);
//     console.log(`📊 Report Summary:`);
//     console.log(`   Total Outstanding: ₹${grandTotal.toLocaleString('en-IN')}`);
//     console.log(`   Total Invoices: ${mockPaymentData.length}`);
//     console.log(`   Aging Breakdown:`);
    
//     Object.keys(agingBuckets).forEach(key => {
//       const bucket = agingBuckets[key];
//       if (bucket.payments.length > 0) {
//         console.log(`     ${bucket.title}: ${bucket.payments.length} invoices, ₹${bucket.total.toLocaleString('en-IN')}`);
//       }
//     });
    
//     console.log(`\n🎯 Open the file "${filename}" to see how your aging report will look!`);
    
//     return filename;

//   } catch (error) {
//     console.error('❌ Error generating PDF preview:', error);
//     throw error;
//   }
// }

// // Run the preview generation
// if (require.main === module) {
//   generatePreviewPDF()
//     .then(filename => {
//       console.log(`\n🚀 PDF Preview Complete!`);
//       console.log(`📁 File: ${filename}`);
//       console.log(`💡 This shows exactly how your aging reports will look with real data.`);
//     })
//     .catch(error => {
//       console.error('Failed to generate PDF preview:', error);
//     });
// }

// module.exports = { generatePreviewPDF };




// V2
// pdf-preview-test.js - Standalone script to preview the aging report PDF
// const PDFDocument = require('pdfkit');
// const fs = require('fs');

// // Mock data that simulates your payment_reminders table
// const mockPaymentData = [
//   // 25 days overdue (0-30 bucket)
//   {
//     us_id: 'INV-2025-001',
//     amount: 75000,
//     due_date: '2024-06-23', // 25 days ago
//     payment_method: 'Bank Transfer',
//     status: 'pending',
//     days_overdue: 25
//   },
//   {
//     us_id: 'INV-2025-002', 
//     amount: 45000,
//     due_date: '2024-06-20', // 28 days ago
//     payment_method: 'UPI',
//     status: 'pending',
//     days_overdue: 28
//   },
  
//   // 45 days overdue (31-60 bucket)
//   {
//     us_id: 'INV-2025-003',
//     amount: 120000,
//     due_date: '2024-06-03', // 45 days ago
//     payment_method: 'Bank Transfer', 
//     status: 'pending',
//     days_overdue: 45
//   },
//   {
//     us_id: 'INV-2025-004',
//     amount: 80000,
//     due_date: '2024-05-30', // 49 days ago
//     payment_method: 'Cheque',
//     status: 'pending',
//     days_overdue: 49
//   },
  
//   // 75 days overdue (61-90 bucket)
//   {
//     us_id: 'INV-2025-005',
//     amount: 200000,
//     due_date: '2024-05-04', // 75 days ago
//     payment_method: 'Bank Transfer',
//     status: 'pending', 
//     days_overdue: 75
//   },
  
//   // 105 days overdue (91-120 bucket)
//   {
//     us_id: 'INV-2025-006',
//     amount: 150000,
//     due_date: '2024-04-04', // 105 days ago
//     payment_method: 'UPI',
//     status: 'pending',
//     days_overdue: 105
//   },
  
//   // 135 days overdue (121-150 bucket)
//   {
//     us_id: 'INV-2025-007',
//     amount: 300000,
//     due_date: '2024-03-05', // 135 days ago
//     payment_method: 'Bank Transfer',
//     status: 'pending',
//     days_overdue: 135
//   },
  
//   // 165 days overdue (151-180 bucket)
//   {
//     us_id: 'INV-2025-008',
//     amount: 90000,
//     due_date: '2024-02-03', // 165 days ago
//     payment_method: 'Cheque',
//     status: 'pending',
//     days_overdue: 165
//   }
// ];

// // Mock company information
// const mockCompanyInfo = {
//   from_company: 'ABC Technology Solutions Pvt Ltd',
//   send_to_company: 'XYZ Enterprises Limited',
//   send_to_name: 'Rajesh Kumar',
//   send_to_phone: '+91 98765 43210'
// };

// // Function to generate preview PDF
// async function generatePreviewPDF() {
//   try {
//     console.log('🎨 Generating PDF preview...');

//     // Categorize payments by aging buckets
//     const agingBuckets = {
//       past_30_days: { payments: [], total: 0, title: "0-30 Days Overdue" },
//       past_60_days: { payments: [], total: 0, title: "31-60 Days Overdue" },
//       past_90_days: { payments: [], total: 0, title: "61-90 Days Overdue" },
//       past_120_days: { payments: [], total: 0, title: "91-120 Days Overdue" },
//       past_150_days: { payments: [], total: 0, title: "121-150 Days Overdue" },
//       past_180_days: { payments: [], total: 0, title: "151-180 Days Overdue" }
//     };

//     let grandTotal = 0;

//     // Categorize each payment
//     mockPaymentData.forEach(payment => {
//       const amount = parseFloat(payment.amount) || 0;
//       grandTotal += amount;
      
//       if (payment.days_overdue <= 30) {
//         agingBuckets.past_30_days.payments.push(payment);
//         agingBuckets.past_30_days.total += amount;
//       } else if (payment.days_overdue <= 60) {
//         agingBuckets.past_60_days.payments.push(payment);
//         agingBuckets.past_60_days.total += amount;
//       } else if (payment.days_overdue <= 90) {
//         agingBuckets.past_90_days.payments.push(payment);
//         agingBuckets.past_90_days.total += amount;
//       } else if (payment.days_overdue <= 120) {
//         agingBuckets.past_120_days.payments.push(payment);
//         agingBuckets.past_120_days.total += amount;
//       } else if (payment.days_overdue <= 150) {
//         agingBuckets.past_150_days.payments.push(payment);
//         agingBuckets.past_150_days.total += amount;
//       } else if (payment.days_overdue <= 180) {
//         agingBuckets.past_180_days.payments.push(payment);
//         agingBuckets.past_180_days.total += amount;
//       }
//     });

//     // Generate filename
//     const filename = `Aging_Report_Preview_${Date.now()}.pdf`;
    
//     // Create PDF document
//     const pdfDoc = new PDFDocument({
//       margin: 30,
//       size: 'A4',
//       layout: 'portrait'
//     });
    
//     // Set up file writing
//     const writeStream = fs.createWriteStream(filename);
//     pdfDoc.pipe(writeStream);

//     // Header with logo and company info
//     const pageWidth = pdfDoc.page.width - 60; // Account for margins
    
//     // Company Logo (circular - black and white)
//     pdfDoc.circle(50, 50, 30)
//       .fillColor('black')
//       .fill();
    
//     pdfDoc.fillColor('white')
//       .fontSize(20)
//       .font('Helvetica-Bold')
//       .text(mockCompanyInfo.from_company.charAt(0), 35, 35, { width: 30, align: 'center' });

//     // Company name and report title
//     pdfDoc.fillColor('black')
//       .fontSize(24)
//       .font('Helvetica-Bold')
//       .text(mockCompanyInfo.from_company, 100, 40);

//     // Report date (right aligned)
//     const currentDate = new Date().toLocaleDateString('en-IN', {
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric'
//     });
    
//     pdfDoc.fontSize(12)
//       .font('Helvetica')
//       .text(`Report Date: ${currentDate}`, pageWidth - 150, 45, { width: 150, align: 'right' });


//     pdfDoc.moveDown(1);

//     // Recipient info box (black border only)
//     const recipientY = pdfDoc.y;
//     pdfDoc.rect(30, recipientY, pageWidth, 60)
//       .strokeColor('black')
//       .lineWidth(1)
//       .stroke();

//     pdfDoc.fillColor('black')
//       .fontSize(14)
//       .font('Helvetica-Bold')
//       .text('Outstanding Payments For:', 40, recipientY + 10);

//     pdfDoc.fontSize(12)
//       .font('Helvetica')
//       .text(`Company: ${mockCompanyInfo.send_to_company}`, 40, recipientY + 30)
//       .text(`Contact: ${mockCompanyInfo.send_to_name}`, 40, recipientY + 45)
//       .text(`Phone: ${mockCompanyInfo.send_to_phone}`, 300, recipientY + 45);

//     pdfDoc.moveDown(2);

//     // Summary section (dashed border boxes)
//     const summaryY = pdfDoc.y;
//     const cardWidth = (pageWidth - 20) / 2;
    
//     // Total Outstanding box
//     pdfDoc.rect(30, summaryY, cardWidth, 40)
//       .strokeColor('black')
//       .lineWidth(1)
//       .dash(3, { space: 2 })
//       .stroke()
//       .undash();
    
//     pdfDoc.fillColor('black')
//       .fontSize(10)
//       .font('Helvetica-Bold')
//       .text('TOTAL OUTSTANDING', 40, summaryY + 8);
    
//     pdfDoc.fontSize(14)
//       .font('Helvetica-Bold')
//       .text(`₹${grandTotal.toLocaleString('en-IN')}`, 40, summaryY + 20);

//     // Invoice count box
//     pdfDoc.rect(50 + cardWidth, summaryY, cardWidth, 40)
//       .strokeColor('black')
//       .lineWidth(1)
//       .dash(3, { space: 2 })
//       .stroke()
//       .undash();
    
//     pdfDoc.fillColor('black')
//       .fontSize(10)
//       .font('Helvetica-Bold')
//       .text('TOTAL INVOICES', 60 + cardWidth, summaryY + 8);
    
//     pdfDoc.fontSize(14)
//       .font('Helvetica-Bold')
//       .text(`${mockPaymentData.length} Invoices`, 60 + cardWidth, summaryY + 20);

//     pdfDoc.moveDown(3);

//     // Generate tables for each aging bucket
//     Object.keys(agingBuckets).forEach((bucketKey, index) => {
//       const bucket = agingBuckets[bucketKey];
      
//       // Add new page if needed (except for first table)
//       if (index > 0 && pdfDoc.y > 650) {
//         pdfDoc.addPage();
//       }

//       // Bucket header (black background with smaller font)
//       const headerY = pdfDoc.y;
//       pdfDoc.rect(30, headerY, pageWidth, 30)
//         .fillColor('black')
//         .fill();

//       pdfDoc.fillColor('white')
//         .fontSize(12)
//         .font('Helvetica-Bold')
//         .text(`${bucket.title} (${bucket.payments.length} invoice${bucket.payments.length !== 1 ? 's' : ''})`, 40, headerY + 6);

//       pdfDoc.fontSize(11)
//         .text(`₹${bucket.total.toLocaleString('en-IN')}`, pageWidth - 100, headerY + 6, { width: 80, align: 'right' });

//       pdfDoc.moveDown(0.5);

//       if (bucket.payments.length > 0) {
//         // Table headers (black background with smaller font)
//         const tableY = pdfDoc.y;
//         const colWidths = [100, 80, 80, 60, 100, 80]; // Column widths
//         let currentX = 30;

//         // Header background (black)
//         pdfDoc.rect(30, tableY, pageWidth, 20)
//           .fillColor('black')
//           .fill();

//         // Header text (white on black)
//         const headers = ['Invoice ID', 'Amount', 'Due Date', 'Days Overdue', 'Payment Method', 'Status'];
//         pdfDoc.fillColor('white')
//           .fontSize(9)
//           .font('Helvetica-Bold');

//         headers.forEach((header, i) => {
//           pdfDoc.text(header, currentX + 3, tableY + 6, { width: colWidths[i] - 6, align: 'left' });
//           currentX += colWidths[i];
//         });

//         pdfDoc.moveDown(0.2);

//         // Table rows (dashed borders)
//         bucket.payments.forEach((payment, rowIndex) => {
//           const rowY = pdfDoc.y;
//           currentX = 30;

//           // Dashed border for rows
//           pdfDoc.rect(30, rowY, pageWidth, 18)
//             .strokeColor('black')
//             .lineWidth(0.3)
//             .dash(2, { space: 1 })
//             .stroke()
//             .undash();

//           // Row data
//           const rowData = [
//             payment.us_id,
//             `₹${parseFloat(payment.amount).toLocaleString('en-IN')}`,
//             new Date(payment.due_date).toLocaleDateString('en-IN'),
//             `${payment.days_overdue} days`,
//             payment.payment_method,
//             payment.status.toUpperCase()
//           ];

//           pdfDoc.fillColor('black')
//             .fontSize(8)
//             .font('Helvetica');

//           rowData.forEach((data, i) => {
//             const align = i === 1 ? 'right' : 'left'; // Right align amount
//             pdfDoc.text(data, currentX + 3, rowY + 5, { 
//               width: colWidths[i] - 6, 
//               align: align,
//               ellipsis: true 
//             });
//             currentX += colWidths[i];
//           });

//           pdfDoc.moveDown(0.2);
//         });
//       } else {
//         // No data message (dashed border box)
//         pdfDoc.rect(30, pdfDoc.y, pageWidth, 30)
//           .strokeColor('black')
//           .lineWidth(0.5)
//           .dash(3, { space: 2 })
//           .stroke()
//           .undash();

//         pdfDoc.fillColor('black')
//           .fontSize(10)
//           .font('Helvetica')
//           .text('No overdue payments in this category', 40, pdfDoc.y + 10, { align: 'center' });
//       }

//       pdfDoc.moveDown(1);
//     });

//     // Footer (simple black line separator)
//     if (pdfDoc.y > 700) {
//       pdfDoc.addPage();
//     }

//     pdfDoc.rect(30, pdfDoc.y, pageWidth, 2)
//       .fillColor('black')
//       .fill();

//     pdfDoc.moveDown(1);

//     pdfDoc.fillColor('black')
//       .fontSize(10)
//       .font('Helvetica-Bold')
//       .text('Payment Instructions:', { align: 'center' });

//     pdfDoc.fontSize(8)
//       .font('Helvetica')
//       .text('Please settle the above outstanding amounts at the earliest to avoid any service disruption.', { align: 'center' })
//       .text(`For any queries, please contact: ${mockCompanyInfo.from_company}`, { align: 'center' })
//       .text(`This is an automatically generated report on ${currentDate}`, { align: 'center' });

//     // End the PDF creation
//     pdfDoc.end();

//     // Wait for the PDF to be written
//     await new Promise((resolve, reject) => {
//       writeStream.on('finish', resolve);
//       writeStream.on('error', reject);
//     });

//     console.log(`✅ PDF preview created: ${filename}`);
//     console.log(`📊 Report Summary:`);
//     console.log(`   Total Outstanding: ₹${grandTotal.toLocaleString('en-IN')}`);
//     console.log(`   Total Invoices: ${mockPaymentData.length}`);
//     console.log(`   Aging Breakdown:`);
    
//     Object.keys(agingBuckets).forEach(key => {
//       const bucket = agingBuckets[key];
//       if (bucket.payments.length > 0) {
//         console.log(`     ${bucket.title}: ${bucket.payments.length} invoices, ₹${bucket.total.toLocaleString('en-IN')}`);
//       }
//     });
    
//     console.log(`\n🎯 Open the file "${filename}" to see how your aging report will look!`);
    
//     return filename;

//   } catch (error) {
//     console.error('❌ Error generating PDF preview:', error);
//     throw error;
//   }
// }

// // Run the preview generation
// if (require.main === module) {
//   generatePreviewPDF()
//     .then(filename => {
//       console.log(`\n🚀 PDF Preview Complete!`);
//       console.log(`📁 File: ${filename}`);
//       console.log(`💡 This shows exactly how your aging reports will look with real data.`);
//     })
//     .catch(error => {
//       console.error('Failed to generate PDF preview:', error);
//     });
// }

// module.exports = { generatePreviewPDF };


const PDFDocument = require('pdfkit');
const fs = require('fs');

// Mock data that simulates your payment_reminders table
const mockPaymentData = [
  // 25 days overdue (0-30 bucket)
  {
    us_id: 'INV-2025-001',
    amount: 75000,
    due_date: '2024-06-23', // 25 days ago
    payment_method: 'Bank Transfer',
    status: 'pending',
    days_overdue: 25
  },
  {
    us_id: 'INV-2025-002', 
    amount: 45000,
    due_date: '2024-06-20', // 28 days ago
    payment_method: 'UPI',
    status: 'pending',
    days_overdue: 28
  },
  
  // 45 days overdue (31-60 bucket)
  {
    us_id: 'INV-2025-003',
    amount: 120000,
    due_date: '2024-06-03', // 45 days ago
    payment_method: 'Bank Transfer', 
    status: 'pending',
    days_overdue: 45
  },
  {
    us_id: 'INV-2025-004',
    amount: 80000,
    due_date: '2024-05-30', // 49 days ago
    payment_method: 'Cheque',
    status: 'pending',
    days_overdue: 49
  },
  
  // 75 days overdue (61-90 bucket)
  {
    us_id: 'INV-2025-005',
    amount: 200000,
    due_date: '2024-05-04', // 75 days ago
    payment_method: 'Bank Transfer',
    status: 'pending', 
    days_overdue: 75
  },
  
  // 105 days overdue (91-120 bucket)
  {
    us_id: 'INV-2025-006',
    amount: 150000,
    due_date: '2024-04-04', // 105 days ago
    payment_method: 'UPI',
    status: 'pending',
    days_overdue: 105
  },
  
  // 135 days overdue (121-150 bucket)
  {
    us_id: 'INV-2025-007',
    amount: 300000,
    due_date: '2024-03-05', // 135 days ago
    payment_method: 'Bank Transfer',
    status: 'pending',
    days_overdue: 135
  },
  
  // 165 days overdue (151-180 bucket)
  {
    us_id: 'INV-2025-008',
    amount: 90000,
    due_date: '2024-02-03', // 165 days ago
    payment_method: 'Cheque',
    status: 'pending',
    days_overdue: 165
  }
];

// Mock company information
const mockCompanyInfo = {
  from_company: 'ABC Technology Solutions Pvt Ltd',
  send_to_company: 'XYZ Enterprises Limited',
  send_to_name: 'Rajesh Kumar',
  send_to_phone: '+91 98765 43210'
};

// Function to generate preview PDF
async function generatePreviewPDF() {
  try {
    console.log('🎨 Generating PDF preview...');

    // Categorize payments by aging buckets
    const agingBuckets = {
      past_30_days: { payments: [], total: 0, title: "0-30 Days Overdue" },
      past_60_days: { payments: [], total: 0, title: "31-60 Days Overdue" },
      past_90_days: { payments: [], total: 0, title: "61-90 Days Overdue" },
      past_120_days: { payments: [], total: 0, title: "91-120 Days Overdue" },
      past_150_days: { payments: [], total: 0, title: "121-150 Days Overdue" },
      past_180_days: { payments: [], total: 0, title: "151-180 Days Overdue" }
    };

    let grandTotal = 0;

    // Categorize each payment
    mockPaymentData.forEach(payment => {
      const amount = parseFloat(payment.amount) || 0;
      grandTotal += amount;
      
      if (payment.days_overdue <= 30) {
        agingBuckets.past_30_days.payments.push(payment);
        agingBuckets.past_30_days.total += amount;
      } else if (payment.days_overdue <= 60) {
        agingBuckets.past_60_days.payments.push(payment);
        agingBuckets.past_60_days.total += amount;
      } else if (payment.days_overdue <= 90) {
        agingBuckets.past_90_days.payments.push(payment);
        agingBuckets.past_90_days.total += amount;
      } else if (payment.days_overdue <= 120) {
        agingBuckets.past_120_days.payments.push(payment);
        agingBuckets.past_120_days.total += amount;
      } else if (payment.days_overdue <= 150) {
        agingBuckets.past_150_days.payments.push(payment);
        agingBuckets.past_150_days.total += amount;
      } else if (payment.days_overdue <= 180) {
        agingBuckets.past_180_days.payments.push(payment);
        agingBuckets.past_180_days.total += amount;
      }
    });

    // Generate filename
    const filename = `Aging_Report_Preview_${Date.now()}.pdf`;
    
    // Create PDF document
    const pdfDoc = new PDFDocument({
      margin: 30,
      size: 'A4',
      layout: 'portrait'
    });
    
    // Set up file writing
    const writeStream = fs.createWriteStream(filename);
    pdfDoc.pipe(writeStream);

    // Header with logo and company info
    const pageWidth = pdfDoc.page.width - 60; // Account for margins
    
    // Company Logo (circular - black and white)
    pdfDoc.circle(50, 50, 30)
      .fillColor('black')
      .fill();
    
    pdfDoc.fillColor('white')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(mockCompanyInfo.from_company.charAt(0), 35, 35, { width: 30, align: 'center' });

    // Company name and report title
    pdfDoc.fillColor('black')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(mockCompanyInfo.from_company, 100, 40);

    // Report date (right aligned)
    const currentDate = new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    pdfDoc.fontSize(12)
      .font('Helvetica')
      .text(`Report Date: ${currentDate}`, pageWidth - 150, 45, { width: 150, align: 'right' });


    pdfDoc.moveDown(3);

    // Recipient info box (black border only)
    const recipientY = pdfDoc.y;
    pdfDoc.rect(30, recipientY, pageWidth, 60)
      .strokeColor('black')
      .lineWidth(1)
      .stroke();

    pdfDoc.fillColor('black')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Outstanding Payments For:', 40, recipientY + 10);

    pdfDoc.fontSize(12)
      .font('Helvetica')
      .text(`Company: ${mockCompanyInfo.send_to_company}`, 40, recipientY + 30)
      .text(`Contact: ${mockCompanyInfo.send_to_name}`, 40, recipientY + 45)
      .text(`Phone: ${mockCompanyInfo.send_to_phone}`, 300, recipientY + 45);

    pdfDoc.moveDown(2);

    // Summary section (dashed border boxes)
    const summaryY = pdfDoc.y;
    const cardWidth = (pageWidth - 20) / 2;
    
    // Total Outstanding box
    pdfDoc.rect(30, summaryY, cardWidth, 40)
      .strokeColor('black')
      .lineWidth(1)
      .dash(3, { space: 2 })
      .stroke()
      .undash();
    
    pdfDoc.fillColor('black')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('TOTAL OUTSTANDING', 40, summaryY + 8);
    
    pdfDoc.fontSize(14)
      .font('Helvetica-Bold')
      .text(`₹${grandTotal.toLocaleString('en-IN')}`, 40, summaryY + 20);

    // Invoice count box
    pdfDoc.rect(50 + cardWidth, summaryY, cardWidth, 40)
      .strokeColor('black')
      .lineWidth(1)
      .dash(3, { space: 2 })
      .stroke()
      .undash();
    
    pdfDoc.fillColor('black')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('TOTAL INVOICES', 60 + cardWidth, summaryY + 8);
    
    pdfDoc.fontSize(14)
      .font('Helvetica-Bold')
      .text(`${mockPaymentData.length} Invoices`, 60 + cardWidth, summaryY + 20);

    pdfDoc.moveDown(3);

    // Generate tables for each aging bucket
    Object.keys(agingBuckets).forEach((bucketKey, index) => {
      const bucket = agingBuckets[bucketKey];
      
      // Add new page if needed (except for first table)
      if (index > 0 && pdfDoc.y > 650) {
        pdfDoc.addPage();
      }

      // Bucket header (black background with smaller font)
      const headerY = pdfDoc.y;
      pdfDoc.rect(30, headerY, pageWidth, 30)
        .fillColor('black')
        .fill();

      pdfDoc.fillColor('white')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${bucket.title} (${bucket.payments.length} invoice${bucket.payments.length !== 1 ? 's' : ''})`, 40, headerY + 6);

      pdfDoc.fontSize(11)
        .text(`₹${bucket.total.toLocaleString('en-IN')}`, pageWidth - 100, headerY + 6, { width: 80, align: 'right' });

      pdfDoc.moveDown(0.5);

      if (bucket.payments.length > 0) {
        // Table headers (black background with smaller font)
        const tableY = pdfDoc.y;
        const colWidths = [100, 80, 80, 90, 100, 80]; // Column widths
        let currentX = 30;

        // Header background (black)
        pdfDoc.rect(30, tableY, pageWidth, 20)
          .fillColor('black')
          .fill();

        // Header text (white on black)
        const headers = ['Invoice ID', 'Amount', 'Due Date', 'Days Overdue', 'Payment Method', 'Status'];
        pdfDoc.fillColor('white')
          .fontSize(9)
          .font('Helvetica-Bold');

        headers.forEach((header, i) => {
          pdfDoc.text(header, currentX + 3, tableY + 6, { width: colWidths[i] - 6, align: 'center' });
          currentX += colWidths[i];
        });

        pdfDoc.moveDown(0.5);

        // Table rows (with only left, right, and bottom borders - NO TOP BORDER)
        bucket.payments.forEach((payment, rowIndex) => {
          const rowY = pdfDoc.y;
          const rowHeight = 18;
          currentX = 30;

          // Draw individual borders for each row (left, right, bottom - no top)
          // Left border
          pdfDoc.moveTo(30, rowY)
            .lineTo(30, rowY + rowHeight)
            .strokeColor('black')
            .lineWidth(0.3)
            .dash(2, { space: 1 })
            .stroke()
            .undash();

          // Right border
          pdfDoc.moveTo(30 + pageWidth, rowY)
            .lineTo(30 + pageWidth, rowY + rowHeight)
            .strokeColor('black')
            .lineWidth(0.3)
            .dash(2, { space: 1 })
            .stroke()
            .undash();

          // Bottom border
          pdfDoc.moveTo(30, rowY + rowHeight)
            .lineTo(30 + pageWidth, rowY + rowHeight)
            .strokeColor('black')
            .lineWidth(0.3)
            .dash(2, { space: 1 })
            .stroke()
            .undash();

          // Draw vertical lines between columns
          let columnX = 30;
          for (let i = 0; i < colWidths.length - 1; i++) {
            columnX += colWidths[i];
            pdfDoc.moveTo(columnX, rowY)
              .lineTo(columnX, rowY + rowHeight)
              .strokeColor('black')
              .lineWidth(0.3)
              .dash(2, { space: 1 })
              .stroke()
              .undash();
          }

          // Row data
          const rowData = [
            payment.us_id,
            `₹${parseFloat(payment.amount).toLocaleString('en-IN')}`,
            new Date(payment.due_date).toLocaleDateString('en-IN'),
            `${payment.days_overdue} days`,
            payment.payment_method,
            payment.status.toUpperCase()
          ];

          pdfDoc.fillColor('black')
            .fontSize(8)
            .font('Helvetica');

          currentX = 30;
          rowData.forEach((data, i) => {
            const align ='center'; // Right align amount
            pdfDoc.text(data, currentX + 3, rowY + 5, { 
              width: colWidths[i] - 6, 
              align: align,
              ellipsis: true 
            });
            currentX += colWidths[i];
          });

          pdfDoc.moveDown(0.2);
        });
      } else {
        // No data message (dashed border box)
        pdfDoc.rect(30, pdfDoc.y, pageWidth, 30)
          .strokeColor('black')
          .lineWidth(0.5)
          .dash(3, { space: 2 })
          .stroke()
          .undash();

        pdfDoc.fillColor('black')
          .fontSize(10)
          .font('Helvetica')
          .text('No overdue payments in this category', 40, pdfDoc.y + 10, { align: 'center' });
      }

      pdfDoc.moveDown(1);
    });

    // Footer (simple black line separator)
    if (pdfDoc.y > 700) {
      pdfDoc.addPage();
    }

    pdfDoc.rect(30, pdfDoc.y, pageWidth, 2)
      .fillColor('black')
      .fill();

    pdfDoc.moveDown(1);

    pdfDoc.fillColor('black')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Payment Instructions:', { align: 'center' });

    pdfDoc.fontSize(8)
      .font('Helvetica')
      .text('Please settle the above outstanding amounts at the earliest to avoid any service disruption.', { align: 'center' })
      .text(`For any queries, please contact: ${mockCompanyInfo.from_company}`, { align: 'center' })
      .text(`This is an automatically generated report on ${currentDate}`, { align: 'center' });

    // End the PDF creation
    pdfDoc.end();

    // Wait for the PDF to be written
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`✅ PDF preview created: ${filename}`);
    console.log(`📊 Report Summary:`);
    console.log(`   Total Outstanding: ₹${grandTotal.toLocaleString('en-IN')}`);
    console.log(`   Total Invoices: ${mockPaymentData.length}`);
    console.log(`   Aging Breakdown:`);
    
    Object.keys(agingBuckets).forEach(key => {
      const bucket = agingBuckets[key];
      if (bucket.payments.length > 0) {
        console.log(`     ${bucket.title}: ${bucket.payments.length} invoices, ₹${bucket.total.toLocaleString('en-IN')}`);
      }
    });
    
    console.log(`\n🎯 Open the file "${filename}" to see how your aging report will look!`);
    
    return filename;

  } catch (error) {
    console.error('❌ Error generating PDF preview:', error);
    throw error;
  }
}

// Run the preview generation
if (require.main === module) {
  generatePreviewPDF()
    .then(filename => {
      console.log(`\n🚀 PDF Preview Complete!`);
      console.log(`📁 File: ${filename}`);
      console.log(`💡 This shows exactly how your aging reports will look with real data.`);
    })
    .catch(error => {
      console.error('Failed to generate PDF preview:', error);
    });
}

module.exports = { generatePreviewPDF };




