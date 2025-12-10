const pool = require("../database/databaseConnection");
const { addPaymentReminderQuery, getPaymentReminderQuery, updatePaymentReminderQuery } = require("../database/queries/referenceQueries");

exports.paymentReminderSetup = async (req, res) => {
  try {
    const { owner_id, number_of_reminders, payment_terms, output_webhooks, api_key } = req.body;

    // Input validation
    if (!owner_id || !number_of_reminders || !payment_terms) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: owner_id, number_of_reminders, and payment_terms are required"
      });
    }

    if (!Number.isInteger(number_of_reminders) || number_of_reminders < 1 || number_of_reminders > 10) {
      return res.status(400).json({
        success: false,
        message: "number_of_reminders must be an integer between 1 and 10"
      });
    }

    const result = await pool.query(
      addPaymentReminderQuery(),
      [owner_id, number_of_reminders, payment_terms, output_webhooks, api_key]
    );

    if (result.rowCount === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to create payment reminder setup"
      });
    }

    // Success response
    res.status(201).json({
      success: true,
      message: "Payment reminder setup created successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error in paymentReminderSetup:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while setting up payment reminder"
    });
  }
};

exports.getPaymentReminderSetup = async (req, res) => {
  try {
    const { owner_id } = req.query;
    console.log(owner_id);
    const data = await pool.query(getPaymentReminderQuery(), [owner_id]);
    console.log("data:", data);
    res.status(200).json({
      success: true,
      data: data.rows[0]
    })
  } catch (e) {
    console.error("Error while fetching Payment Reminder Setup");
    res.status(500).json({
      success: false,
      message: "Error while fetching Payment Reminder Setup"
    })
  }
}

exports.updatePaymentReminderSetup = async (req, res) => {
  try {
    const {
      owner_id,
      number_of_reminders,
      payment_terms,
      output_webhooks,
      days_diff,
    } = req.body;

    const result = await pool.query(updatePaymentReminderQuery(), [
      owner_id,
      number_of_reminders,
      payment_terms,
      output_webhooks, // JS array
      days_diff,       // JS array
    ]);

    res.status(200).json({
      success: true,
      data: result.rows[0], // ✅ fix here
    });

  } catch (e) {
    console.error("Error Updating the Payment Reminder Setup:", e); // include error details for debug
    res.status(500).json({
      success: false,
      message: "Error updating the Payment Reminder Setup",
    });
  }
};

// Working Check Dropdown Setup Controller
// exports.checkDropdownSetup = async (req, res) => {
//   try {
//     const {
//       owner_id,
//       product_name
//     } = req.query;
    
//     // Validate required parameters
//     if (!owner_id || !product_name) {
//       return res.status(400).json({
//         success: false,
//         message: "owner_id and product_name are required parameters"
//       });
//     }
    
//     const query = `SELECT * FROM dropdown_setup WHERE owner_id = $1 AND product_name = $2`;
//     const result = await pool.query(query, [owner_id, product_name]);

//     const setupExists = result.rows.length > 0;
    
//     // Parse JSON fields if setup exists
//     let setupData = null;
//     if (setupExists) {
//       setupData = {
//         ...result.rows[0],
//         mapping: typeof result.rows[0].mapping === 'string' 
//           ? JSON.parse(result.rows[0].mapping) 
//           : result.rows[0].mapping,
//         columnOrder: result.rows[0].column_order 
//           ? (typeof result.rows[0].column_order === 'string' 
//               ? JSON.parse(result.rows[0].column_order) 
//               : result.rows[0].column_order)
//           : {}
//       };
//     }
    
//     res.status(200).json({
//       success: true,
//       exists: setupExists,
//       setup: setupData,
//       message: setupExists ? "Setup found" : "No setup found"
//     });

//   } catch (e) {
//     console.error("Error checking dropdown setup:", e);
//     res.status(500).json({
//       success: false,
//       message: "Error checking dropdown setup",
//       error: e.message
//     });
//   }
// };

exports.checkDropdownSetup = async (req, res) => {
  try {
    const {
      owner_id,
      product_name
    } = req.query;
    
    if (!owner_id || !product_name) {
      return res.status(400).json({
        success: false,
        message: "owner_id and product_name are required parameters"
      });
    }
    
    const query = `SELECT * FROM dropdown_setup WHERE owner_id = $1 AND product_name = $2`;
    const result = await pool.query(query, [owner_id, product_name]);

    const setupExists = result.rows.length > 0;
    
    let setupData = null;
    if (setupExists) {
      setupData = {
        ...result.rows[0],
        mapping: typeof result.rows[0].mapping === 'string' 
          ? JSON.parse(result.rows[0].mapping) 
          : result.rows[0].mapping,
        columnOrder: result.rows[0].column_order 
          ? (typeof result.rows[0].column_order === 'string' 
              ? JSON.parse(result.rows[0].column_order) 
              : result.rows[0].column_order)
          : {},
        webhook: result.rows[0].webhook || null  // Add this line
      };
    }
    
    res.status(200).json({
      success: true,
      exists: setupExists,
      setup: setupData,
      message: setupExists ? "Setup found" : "No setup found"
    });

  } catch (e) {
    console.error("Error checking dropdown setup:", e);
    res.status(500).json({
      success: false,
      message: "Error checking dropdown setup",
      error: e.message
    });
  }
};

// Working Dropdown Setup Controllers for create and update setup
// exports.createDropdownSetup = async (req, res) => {
//   try {
//     const {
//       owner_id,
//       product_name,
//       mapping,
//       columnOrder
//     } = req.body;

//     // Validate required fields
//     if (!owner_id || !product_name || !mapping) {
//       return res.status(400).json({
//         success: false,
//         message: "owner_id, product_name, and mapping are required fields"
//       });
//     }

//     console.log('Creating setup with:', { owner_id, product_name, mapping, columnOrder }); // Debug log

//     // Check if setup already exists
//     const checkQuery = `SELECT id FROM dropdown_setup WHERE owner_id = $1 AND product_name = $2`;
//     const existingSetup = await pool.query(checkQuery, [owner_id, product_name]);

//     if (existingSetup.rows.length > 0) {
//       return res.status(409).json({
//         success: false,
//         message: "Setup already exists for this owner_id and product_name. Use update instead."
//       });
//     }

//     // Create new setup with both mapping and column_order
//     const insertQuery = `
//       INSERT INTO dropdown_setup (owner_id, product_name, mapping, column_order, created_at, updated_at) 
//       VALUES ($1, $2, $3, $4, NOW(), NOW()) 
//       RETURNING *
//     `;
    
//     // FIXED: Don't JSON.stringify if already an object, stringify directly
//     const mappingJson = typeof mapping === 'string' ? mapping : JSON.stringify(mapping);
//     const columnOrderJson = columnOrder ? (typeof columnOrder === 'string' ? columnOrder : JSON.stringify(columnOrder)) : null;
    
//     const result = await pool.query(insertQuery, [
//       owner_id, 
//       product_name, 
//       mappingJson,
//       columnOrderJson
//     ]);

//     // Parse the returned data for response
//     const responseData = {
//       ...result.rows[0],
//       mapping: JSON.parse(result.rows[0].mapping),
//       columnOrder: result.rows[0].column_order ? JSON.parse(result.rows[0].column_order) : {}
//     };

//     res.status(201).json({
//       success: true,
//       data: responseData,
//       message: "Dropdown setup created successfully"
//     });

//   } catch (e) {
//     console.error("Error creating dropdown setup:", e);
//     res.status(500).json({
//       success: false,
//       message: "Error creating dropdown setup",
//       error: e.message
//     });
//   }
// };

// exports.updateDropdownSetup = async (req, res) => {
//   try {
//     const {
//       owner_id,
//       product_name,
//       mapping,
//       columnOrder
//     } = req.body;

//     // Validate required fields
//     if (!owner_id || !product_name || !mapping) {
//       return res.status(400).json({
//         success: false,
//         message: "owner_id, product_name, and mapping are required fields"
//       });
//     }

//     console.log('Updating setup with:', { owner_id, product_name, mapping, columnOrder });

//     // Check if setup exists
//     const checkQuery = `SELECT id FROM dropdown_setup WHERE owner_id = $1 AND product_name = $2`;
//     const existingSetup = await pool.query(checkQuery, [owner_id, product_name]);

//     if (existingSetup.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Setup not found for this owner_id and product_name. Create setup first."
//       });
//     }

//     // Update existing setup with both mapping and column_order
//     const updateQuery = `
//       UPDATE dropdown_setup 
//       SET mapping = $3, column_order = $4, updated_at = NOW() 
//       WHERE owner_id = $1 AND product_name = $2 
//       RETURNING *
//     `;
    
//     // Ensure proper JSON stringification
//     const mappingJson = JSON.stringify(mapping);
//     const columnOrderJson = columnOrder ? JSON.stringify(columnOrder) : null;
    
//     console.log('Stringified data:', { mappingJson, columnOrderJson }); // Debug log
    
//     const result = await pool.query(updateQuery, [
//       owner_id, 
//       product_name, 
//       mappingJson,
//       columnOrderJson
//     ]);

//     // FIXED: Safer parsing of returned data
//     const responseData = {
//       ...result.rows[0]
//     };

//     // Only parse if the field exists and is a string
//     if (result.rows[0].mapping && typeof result.rows[0].mapping === 'string') {
//       try {
//         responseData.mapping = JSON.parse(result.rows[0].mapping);
//       } catch (e) {
//         console.error('Error parsing mapping:', e);
//         responseData.mapping = result.rows[0].mapping;
//       }
//     } else {
//       responseData.mapping = result.rows[0].mapping || {};
//     }

//     // Only parse if the field exists and is a string
//     if (result.rows[0].column_order && typeof result.rows[0].column_order === 'string') {
//       try {
//         responseData.columnOrder = JSON.parse(result.rows[0].column_order);
//       } catch (e) {
//         console.error('Error parsing column_order:', e);
//         responseData.columnOrder = result.rows[0].column_order;
//       }
//     } else {
//       responseData.columnOrder = result.rows[0].column_order || {};
//     }

//     res.status(200).json({
//       success: true,
//       data: responseData,
//       message: "Dropdown setup updated successfully"
//     });

//   } catch (e) {
//     console.error("Error updating dropdown setup:", e);
//     res.status(500).json({
//       success: false,
//       message: "Error updating dropdown setup",
//       error: e.message
//     });
//   }
// };

exports.createDropdownSetup = async (req, res) => {
  try {
    const {
      owner_id,
      product_name,
      mapping,
      columnOrder,
      webhook_input  // Add this
    } = req.body;

    // Validate required fields
    if (!owner_id || !product_name || !mapping) {
      return res.status(400).json({
        success: false,
        message: "owner_id, product_name, and mapping are required fields"
      });
    }

    console.log('Creating setup with:', { owner_id, product_name, mapping, columnOrder, webhook_input });

    // Check if setup already exists
    const checkQuery = `SELECT id FROM dropdown_setup WHERE owner_id = $1 AND product_name = $2`;
    const existingSetup = await pool.query(checkQuery, [owner_id, product_name]);

    if (existingSetup.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Setup already exists for this owner_id and product_name. Use update instead."
      });
    }

    // Create new setup with mapping, column_order, and webhook
    const insertQuery = `
      INSERT INTO dropdown_setup (owner_id, product_name, mapping, column_order, webhook, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
      RETURNING *
    `;
    
    const mappingJson = typeof mapping === 'string' ? mapping : JSON.stringify(mapping);
    const columnOrderJson = columnOrder ? (typeof columnOrder === 'string' ? columnOrder : JSON.stringify(columnOrder)) : null;
    
    const result = await pool.query(insertQuery, [
      owner_id, 
      product_name, 
      mappingJson,
      columnOrderJson,
      webhook_input || null  // Add webhook value
    ]);

    // Parse the returned data for response
    const responseData = {
      ...result.rows[0],
      mapping: JSON.parse(result.rows[0].mapping),
      columnOrder: result.rows[0].column_order ? JSON.parse(result.rows[0].column_order) : {},
      webhook: result.rows[0].webhook || null
    };

    res.status(201).json({
      success: true,
      data: responseData,
      message: "Dropdown setup created successfully"
    });

  } catch (e) {
    console.error("Error creating dropdown setup:", e);
    res.status(500).json({
      success: false,
      message: "Error creating dropdown setup",
      error: e.message
    });
  }
};

exports.updateDropdownSetup = async (req, res) => {
  try {
    const {
      owner_id,
      product_name,
      mapping,
      columnOrder,
      webhook_input  // Add this
    } = req.body;

    // Validate required fields
    if (!owner_id || !product_name || !mapping) {
      return res.status(400).json({
        success: false,
        message: "owner_id, product_name, and mapping are required fields"
      });
    }

    console.log('Updating setup with:', { owner_id, product_name, mapping, columnOrder, webhook_input });

    // Check if setup exists
    const checkQuery = `SELECT id FROM dropdown_setup WHERE owner_id = $1 AND product_name = $2`;
    const existingSetup = await pool.query(checkQuery, [owner_id, product_name]);

    if (existingSetup.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Setup not found for this owner_id and product_name. Create setup first."
      });
    }

    // Update existing setup with mapping, column_order, and webhook
    const updateQuery = `
      UPDATE dropdown_setup 
      SET mapping = $3, column_order = $4, webhook = $5, updated_at = NOW() 
      WHERE owner_id = $1 AND product_name = $2 
      RETURNING *
    `;
    
    const mappingJson = JSON.stringify(mapping);
    const columnOrderJson = columnOrder ? JSON.stringify(columnOrder) : null;
    
    console.log('Stringified data:', { mappingJson, columnOrderJson, webhook_input });
    
    const result = await pool.query(updateQuery, [
      owner_id, 
      product_name, 
      mappingJson,
      columnOrderJson,
      webhook_input || null  // Add webhook value
    ]);

    // Safer parsing of returned data
    const responseData = {
      ...result.rows[0]
    };

    if (result.rows[0].mapping && typeof result.rows[0].mapping === 'string') {
      try {
        responseData.mapping = JSON.parse(result.rows[0].mapping);
      } catch (e) {
        console.error('Error parsing mapping:', e);
        responseData.mapping = result.rows[0].mapping;
      }
    } else {
      responseData.mapping = result.rows[0].mapping || {};
    }

    if (result.rows[0].column_order && typeof result.rows[0].column_order === 'string') {
      try {
        responseData.columnOrder = JSON.parse(result.rows[0].column_order);
      } catch (e) {
        console.error('Error parsing column_order:', e);
        responseData.columnOrder = result.rows[0].column_order;
      }
    } else {
      responseData.columnOrder = result.rows[0].column_order || {};
    }

    // Add webhook to response
    responseData.webhook = result.rows[0].webhook || null;

    res.status(200).json({
      success: true,
      data: responseData,
      message: "Dropdown setup updated successfully"
    });

  } catch (e) {
    console.error("Error updating dropdown setup:", e);
    res.status(500).json({
      success: false,
      message: "Error updating dropdown setup",
      error: e.message
    });
  }
};


exports.deleteDropdownSetup = async (req, res) => {
  try {
    const {
      owner_id,
      product_name
    } = req.query;

    // Validate required parameters
    if (!owner_id || !product_name) {
      return res.status(400).json({
        success: false,
        message: "owner_id and product_name are required parameters"
      });
    }

    // Check if setup exists
    const checkQuery = `SELECT id FROM dropdown_setup WHERE owner_id = $1 AND product_name = $2`;
    const existingSetup = await pool.query(checkQuery, [owner_id, product_name]);

    if (existingSetup.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Setup not found for this owner_id and product_name"
      });
    }

    // Delete setup
    const deleteQuery = `DELETE FROM dropdown_setup WHERE owner_id = $1 AND product_name = $2 RETURNING *`;
    const result = await pool.query(deleteQuery, [owner_id, product_name]);

    res.status(200).json({
      success: true,
      data: result.rows[0],
      message: "Dropdown setup deleted successfully"
    });

  } catch (e) {
    console.error("Error deleting dropdown setup:", e);
    res.status(500).json({
      success: false,
      message: "Error deleting dropdown setup",
      error: e.message
    });
  }
};