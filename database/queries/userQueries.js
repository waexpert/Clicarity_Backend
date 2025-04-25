const getUserById = "SELECT * FROM users WHERE id = $1";
const getUserByEmail = "SELECT * FROM users WHERE email = $1";
const checkEmailExists = "SELECT * FROM users WHERE email = $1";
const checkPhoneExists = "SELECT * FROM users WHERE phone_number = $1";
const checkUser = "SELECT * FROM users WHERE email = $1 OR phone_number = $2";
const addUser = "INSERT INTO users (first_name,last_name,email,password,phone_number,country,currency,is_verified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *";
const updatePassword = "UPDATE users SET password = $1 WHERE id = $2";




module.exports ={
    getUserById,
    getUserByEmail,
    checkEmailExists,
    checkPhoneExists,
    checkUser,
    addUser,
    updatePassword

}