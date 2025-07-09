const pool = require("../database/databaseConnection");
const queries = require("../database/queries/userQueries")
const {sendJWTToken} = require("../utils/jwtServices")
const jwt = require("jsonwebtoken");


const bcrypt = require('bcrypt');
const { sendEmail } = require("../utils/emailService");

// exports.registerUser = async (req, res) => {
//   const { first_name, last_name, email, password, phone_number, country, currency, is_verified } = req.body;

//   if (!email || !password || !first_name) {
//     return res.status(400).json({ error: "Missing required fields" });
//   }

//   try {
//     const userExists = await pool.query(queries.checkUser, [email, phone_number]);

//     if (userExists.rows.length) {
//       return res.status(400).json({ error: "Email or phone number already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const result = await pool.query(queries.addUser, [
//       first_name,
//       last_name,
//       email,
//       hashedPassword,
//       phone_number,
//       country,
//       currency,
//       is_verified,
//     ]);
    
//     if (!result || !result.rows || result.rows.length === 0) {
//       return res.status(500).json({ error: "User inserted but data not returned." });
//     }
    
//     const user = result.rows[0];
//     // return res.status(201).json({ message: "User created successfully", user });

//     sendEmail(email);
//   sendJWTToken(user, 201, res);
//   } catch (error) {
//     console.error("Registration error:", error);
//     return res.status(500).json({ error: "Internal Server Error" ,errorMessage:error });
//   }
// };

// Helper function to generate random 8-digit number
function generateRandom8Digit() {
  return Math.floor(10000000 + Math.random() * 90000000);
}

// Helper function to create schema
async function createUserSchema(schemaName) {
  const createSchemaQuery = `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`;
  await pool.query(createSchemaQuery);
}

// Helper function to create team member table with user data
async function createTeamMemberTable(schemaName, userData) {
  const teamMemberFields = [
    { name: 'name', type: 'text', systemField: false },
    { name: 'number', type: 'text', systemField: false },
    { name: 'empid', type: 'text', systemField: false },
    { name: 'department', type: 'text', systemField: false },
    { name: 'manager_name', type: 'text', systemField: false },
    { name: 'birthday', type: 'date', systemField: false }
  ];

  // Create the table
  const createTableQuery = generateCreateTableQuery(teamMemberFields, 'team_member', true, schemaName);
  await pool.query(createTableQuery);

  // Insert user data into team member table
  const userInsertQuery = generateUserTeamMemberData(schemaName, userData);
  await pool.query(userInsertQuery);
}

// Helper function to generate user team member data
function generateUserTeamMemberData(schemaName, userData) {
  const currentDate = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
  
  const fullTableName = `"${schemaName}"."team_member"`;
  
  // Create full name from first_name and last_name
  const fullName = `${userData.first_name} ${userData.last_name || ''}`.trim();
  
  const query = `
    INSERT INTO ${fullTableName} (
      "id", "us_id", "name", "number", "empid", "department", "manager_name", "birthday"
    ) VALUES (
      uuid_generate_v4(), 
      'user_${userData.first_name.toLowerCase()}', 
      '${fullName}', 
      '${userData.phone_number || ''}', 
      'EMP${Math.floor(1000 + Math.random() * 9000)}', 
      'General', 
      '${userData.first_name}', 
      '${currentDate}'
    )
  `;
  
  return query;
}

// Updated registerUser function
exports.registerUser = async (req, res) => {
  const { first_name, last_name, email, password, phone_number, country, currency, is_verified } = req.body;

  if (!email || !password || !first_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const userExists = await pool.query(queries.checkUser, [email, phone_number]);

    if (userExists.rows.length) {
      return res.status(400).json({ error: "Email or phone number already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate schema name: username + random 8-digit number
    const username = first_name.toLowerCase();
    const random8Digit = generateRandom8Digit();
    const schemaName = `${username}_${random8Digit}`;

    // Create user with schema_name
    const result = await pool.query(queries.addUser, [
      first_name,
      last_name,
      email,
      hashedPassword,
      phone_number,
      country,
      currency,
      is_verified,
      schemaName  // Add schema_name to the insert query
    ]);
    
    if (!result || !result.rows || result.rows.length === 0) {
      return res.status(500).json({ error: "User inserted but data not returned." });
    }
    
    const user = result.rows[0];

    // Create the user's schema
    await createUserSchema(schemaName);
    
    // Create the team member table with user data
    const userData = {
      first_name,
      last_name,
      phone_number,
      email
    };
    await createTeamMemberTable(schemaName, userData);

    sendEmail(email);
    sendJWTToken(user, 201, res);
    
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Internal Server Error", errorMessage: error });
  }
};



exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt:", email);

    const result = await pool.query(queries.getUserByEmail, [email]);
    console.log("Query result:", result.rows);

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    sendEmail(email);
    sendJWTToken(user, 200, res);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

  
// logout 
exports.logout = async(req,res,next)=>{
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ success: true });
}

// forget Password
// exports.forgetPassword = async(req,res,next)=>{
//     var user = await pool.query(queries.getUserByEmail,[email]);
//     if(!user){
//         return next(res.status(401).json({error:"Password or Email does not matched"})); 
//     }
// }


// reset password

// getUser Details
exports.getUserDetails = async(req,res,next)=>{
    const result = await pool.query(queries.getUserById, [req.body.user_id]);
    const user = result.rows[0];
    res.status(200).json({ success: true, user });
    
}

// update password
exports.updatePassword = async (req, res) => {
    const result = await pool.query(queries.getUserById, [req.user.id]);
    const user = result.rows[0];
  
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
  
    const isPasswordMatched = await bcrypt.compare(req.body.oldPassword, user.password);
    if (!isPasswordMatched) {
      return res.status(400).json({ message: "Old password does not match" });
    }
  
    if (req.body.newPassword !== req.body.confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
  
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    await pool.query(queries.updatePassword, [hashedPassword, req.user.id]);
  
    sendJWTToken(user, 200, res);
  }
  

  // refresh Route
exports.refreshToken = (req, res) => {
  const token = req.cookies.refresh_token;
  if (!token) {
    return res.status(401).json({ error: "Refresh token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const accessToken = jwt.sign(
      { id: decoded.id, email: decoded.email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.status(200).json({ success: true });
  } catch (error) {
    return res.status(403).json({ error: "Invalid refresh token" });
  }
};
