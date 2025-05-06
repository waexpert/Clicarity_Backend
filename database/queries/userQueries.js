const getUserById = "SELECT * FROM users WHERE id = $1";
const getUserByEmail = "SELECT * FROM users WHERE email = $1";
const checkEmailExists = "SELECT * FROM users WHERE email = $1";
const checkPhoneExists = "SELECT * FROM users WHERE phone_number = $1";
const checkUser = "SELECT * FROM users WHERE email = $1 OR phone_number = $2";
const addUser = "INSERT INTO users (first_name,last_name,email,password,phone_number,country,currency,is_verified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *";
const updatePassword = "UPDATE users SET password = $1 WHERE id = $2";
const updateApi = "UPDATE users SET api_calls = api_calls - 1 WHERE id = $1";


function createUserTable() {
    return `
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(100),
        password TEXT,
        phone_number VARCHAR(20),
        country VARCHAR(100),
        currency VARCHAR(3),
        is_verified BOOLEAN,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        mfa BOOLEAN,
        mfa_secret TEXT,
        schema_name TEXT,
        role TEXT,
        owner_first_name TEXT,
        owner_id TEXT,
        products_activated TEXT[]
    );
    `;
}



module.exports ={
    getUserById,
    getUserByEmail,
    checkEmailExists,
    checkPhoneExists,
    checkUser,
    addUser,
    updatePassword,
    createUserTable,
    updateApi

}