const pool = require("../database/databaseConnection");
const { addPaymentReminderQuery, getPaymentReminderQuery } = require("../database/queries/referenceQueries");

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

exports.getPaymentReminderSetup = async (req,res) =>{
  try{  
    const {owner_id} = req.query;
    const data = await pool.query(getPaymentReminderQuery(),[owner_id]);
    res.status(200).json({
      success:true,
      data: data.rows[0]
    })
  }catch(e){
    console.error("Error while fetching Payment Reminder Setup");
    res.status(500).json({
      success:false,
      message:"Error while fetching Payment Reminder Setup"
    })
  }
}