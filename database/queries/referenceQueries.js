function createPaymentReminderSetup() {
    return `
    CREATE TABLE IF NOT EXISTS payment_reminder_setup (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
      number_of_reminders INT DEFAULT 1,
      payment_terms INT DEFAULT 30,
      output_webhooks TEXT[],
      api_key TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(owner_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_payment_reminder_setup_owner_id 
    ON payment_reminder_setup(owner_id);
  `;
}

function getPaymentReminderQuery() {
    return `
    SELECT 
     prs.*,
     u.email,
     u.schema_name,
     u.username
     FROM payment_reminder_setup prs
     JOIN users u ON prs.owner_id = u.id
     WHERE prs.owner_id = $1;
    `;
}

function addPaymentReminderQuery() {
    return `
     INSERT INTO payment_reminder_setup (
            owner_id,
            number_of_reminders,
            payment_terms,
            output_webhooks,
            api_key
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
    `;
}

// Additional helpful queries
function updatePaymentReminderQuery() {
    return `
    UPDATE payment_reminder_setup 
    SET 
        number_of_reminders = $2,
        payment_terms = $3,
        output_webhooks = $4,
        api_key = $5,
        updated_at = NOW()
    WHERE owner_id = $1
    RETURNING *;
    `;
}

function deletePaymentReminderQuery() {
    return `
    DELETE FROM payment_reminder_setup 
    WHERE owner_id = $1
    RETURNING *;
    `;
}

module.exports = {
    createPaymentReminderSetup,
    getPaymentReminderQuery,
    addPaymentReminderQuery,
    updatePaymentReminderQuery,
    deletePaymentReminderQuery
};