require("dotenv").config();
const express = require("express");
const app = express();
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const userRoutes = require('./routes/userRoutes.js');
const userPermissionRoutes = require('./routes/secureRoutes.js')
const mfaRoutes = require('./routes/mfaRoutes.js')
const dataRoutes = require('./routes/dataRoutes.js');
const webhookRoutes = require('./routes/webhookRoutes.js');
const pool = require("./database/databaseConnection.js");


const PORT = 3000 || process.env.PORT;
// Basic Middleware
app.use(express.json());
app.use(cookieParser());
app.use(helmet());

// CORS configuration
const corsOptions = {
    origin: 'http://localhost:5173',
    credentials: true, // if you're using cookies or authentication headers
  };
  app.use(cors(corsOptions));
  
// Rate limiting
app.use(rateLimit({windowMs :15 * 60 * 1000, //15 min
    max:10000,
    message : 'Too many requests, please try again later'
}));

// CSRF protection
// app.use(csrf({cookie:true}));

// Routing
app.use('/users', userRoutes);
app.use('/data', dataRoutes);
app.use('/secure', userPermissionRoutes);
app.use('/mfa',mfaRoutes);
app.use('/webhooks',webhookRoutes);


app.listen(PORT,()=>{
    console.log(`Running on PORT: ${PORT}`)
})