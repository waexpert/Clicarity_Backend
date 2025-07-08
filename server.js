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
const dataRoutes = require('./routes/dataRoutes.js')
const { createPdfs } = require("./index2.js");
const pool = require("./database/databaseConnection.js");
const { nanoid } = require('nanoid');
const webhookRoutes = require('./routes/webhookRoutes.js');



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

require("./autoPdfGen.js");

// Routing
app.use('/users', userRoutes);
app.use('/data', dataRoutes);
app.use('/secure', userPermissionRoutes);
app.use('/mfa',mfaRoutes);
app.use('/webhooks',webhookRoutes);
app.get('/getVendors',async(req,res)=>{
    const data = await pool.query(`SELECT * FROM public.processvendors;`)
    res.send(data.rows);
})

app.get('/',(req,res)=>{
res.send("api is working")
})

app.get("/generatePdf",async (req,res)=>{
   const {schemaName,tableName,assignedTo} = req.query;
    const query = `
SELECT * FROM ${schemaName}.${tableName} WHERE assigned_to = '${assignedTo}';  
`;
const result = await pool.query(query);
createPdfs(result.rows,res);

})

//Url Shorting
app.set('query parser', (str) => {
  const result = new URLSearchParams(str);
  const params = {};
  for (const [key, value] of result) {
    params[key] = value;
  }
  return params;
});

// Create table if it doesn't exist
const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shortened_urls (
        id SERIAL PRIMARY KEY,
        original_url TEXT NOT NULL,
        short_code VARCHAR(10) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// Initialize database on startup
initDatabase();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' })); 

app.post('/shorten-raw', express.text({ type: '*/*', limit: '50mb' }), async (req, res) => {
  try {
    const originalUrl = req.body;
    
    if (!originalUrl) {
      return res.status(400).json({ error: 'URL in request body is required' });
    }
    
    // Generate a short code (6 characters)
    const shortCode = nanoid(8);
    
    // Store in database
    await pool.query(
      'INSERT INTO shortened_urls (original_url, short_code) VALUES ($1, $2)',
      [originalUrl, shortCode]
    );
    
    // Construct the shortened URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const shortenedUrl = `${baseUrl}/${shortCode}`;
    
    res.json({
      original_url: originalUrl,
      shortened_url: shortenedUrl,
      short_code: shortCode
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});


// Route to shorten URL - Better handling for complex URLs
app.get('/sh', async (req, res) => {
  console.log('Shorten endpoint accessed');
  
  try {
    // Get the raw URL from the query string - this preserves special characters
    const fullUrl = req.url;
    const urlParamIndex = fullUrl.indexOf('url=');
    
    if (urlParamIndex === -1) {
      console.log('No URL parameter provided');
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Extract everything after 'url='
    const originalUrl = decodeURIComponent(fullUrl.slice(urlParamIndex + 4));
    console.log('Decoded URL:', originalUrl);
    
    // Basic validation - ensure it has a protocol
    if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
      console.log('Invalid URL format - missing protocol');
      return res.status(400).json({ error: 'Invalid URL format - URL must start with http:// or https://' });
    }
    
    // Generate a short code (6 characters)
    const shortCode = nanoid(8);
    console.log('Generated short code:', shortCode);
    
    // Store in database
    await pool.query(
      'INSERT INTO shortened_urls (original_url, short_code) VALUES ($1, $2)',
      [originalUrl, shortCode]
    );
    console.log('URL stored in database');
    
    // Construct the shortened URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const shortenedUrl = `${baseUrl}/api/${shortCode}`;
    console.log('Shortened URL:', shortenedUrl);
    
    res.json({
      original_url: originalUrl,
      shortened_url: shortenedUrl,
      short_code: shortCode
    });
    
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Route to redirect to original URL
app.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    console.log('Redirect requested for short code:', shortCode);
    
    // Look up the original URL in the database
    const result = await pool.query(
      'SELECT original_url FROM shortened_urls WHERE short_code = $1',
      [shortCode]
    );
    
    if (result.rows.length === 0) {
      console.log('Short URL not found:', shortCode);
      return res.status(404).json({ error: 'Short URL not found' });
    }
    
    const originalUrl = result.rows[0].original_url;
    console.log('Redirecting to:', originalUrl);
    
    // Redirect to the original URL
    res.redirect(originalUrl);
    
  } catch (error) {
    console.error('Error redirecting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Simple home page with CLI curl example for long URLs
app.get('/front/shorten', (req, res) => {
   res.send(`
    <html>
    <head>
      <title>URL Shortener</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2 { color: #333; }
        .form-group { margin-bottom: 15px; }
        input[type="text"] { width: 80%; padding: 8px; font-size: 16px; }
        button { padding: 8px 16px; background-color: #4CAF50; color: white; border: none; cursor: pointer; }
        #result { margin-top: 20px; padding: 10px; border: 1px solid #ddd; display: none; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>URL Shortener</h1>
      
      <h2>Method 1: Web Interface</h2>
      <div class="form-group">
        <input type="text" id="url-input" placeholder="Enter a URL to shorten" />
        <button onclick="shortenUrl()">Shorten</button>
      </div>
      <div id="result"></div>
      
         
      <script>
        async function shortenUrl() {
          const url = document.getElementById('url-input').value;
          if (!url) {
            alert('Please enter a URL');
            return;
          }
          
          try {
            // For complex URLs, use the raw endpoint
            if (url.includes('?') && url.length > 500) {
              const response = await fetch('/api/shorten-raw', {
                method: 'POST',
                headers: {
                  'Content-Type': 'text/plain'
                },
                body: url
              });
              const data = await response.json();
              
              if (response.ok) {
                displayResult(data);
              } else {
                alert(data.error || 'Error shortening URL');
              }
            } else {
              // For simpler URLs, use the GET endpoint
              const response = await fetch('/api/sh?url=' + encodeURIComponent(url));
              const data = await response.json();
              
              if (response.ok) {
                displayResult(data);
              } else {
                alert(data.error || 'Error shortening URL');
              }
            }
          } catch (error) {
            alert('Error connecting to server');
          }
        }
        
        function displayResult(data) {
          const resultDiv = document.getElementById('result');
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = \`
            <p>Original URL: \${data.original_url}</p>
            <p>Shortened URL: <a href="\${data.shortened_url}" target="_blank">\${data.shortened_url}</a></p>
          \`;
        }
      </script>
    </body>
    </html>
  `);
});


app.listen(PORT,()=>{
    console.log(`Running on PORT: ${PORT}`)
})
