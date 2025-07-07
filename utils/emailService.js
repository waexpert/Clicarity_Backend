const nodemailer = require("nodemailer");

exports.sendEmail=(email)=>{
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "contact@clicarity.com",
    pass: "hfalamjvgjfcdzmh",
  },
});

const clicartityWelcomeHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Clicarity</title>
    <style>
      .btn{
      width:100px;
      height:20px;
      }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
            }
            
            .content {
                padding: 20px !important;
            }
            
            .header {
                padding: 30px 20px !important;
            }
            
            .header h1 {
                font-size: 24px !important;
            }
            
            .logo {
                width: 200px !important;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header with Logo -->
        <div class="header">
            <img src="https://clicarity.s3.eu-north-1.amazonaws.com/logo.png" alt="Clicarity Logo" class="logo">
        </div>
        
        <!-- Main Content -->
        <div class="content">
            <h2 class="welcome-message">Welcome to Clicarity!</h2>
            
            <p class="message-text">
                We're thrilled to have you join our community! Clicarity is designed to bring clarity and efficiency to your workflow, helping you achieve more with less effort.
            </p>
            
            <p class="message-text">
                Your account has been successfully created, and you're now ready to explore all the powerful features that Clicarity has to offer.
            </p>
            
            <div style="text-align: center;">
                <a href="https://click.wa.expert" class="cta-button">Get Started Now</a>
            </div>
            
            <!-- Features Section -->
            <div class="features">
                <h3 style="color: #333; margin-bottom: 20px;">What you can do with Clicarity:</h3>
                
                <div class="feature-item">
                    <div class="feature-icon">✓</div>
                    <div>Streamline your daily tasks and workflows</div>
                </div>
                
                <div class="feature-item">
                    <div class="feature-icon">✓</div>
                    <div>Collaborate seamlessly with your team</div>
                </div>
                
                <div class="feature-item">
                    <div class="feature-icon">✓</div>
                    <div>Access powerful analytics and insights</div>
                </div>
                
                <div class="feature-item">
                    <div class="feature-icon">✓</div>
                    <div>Integrate with your favorite tools</div>
                </div>
            </div>
            
            <p class="message-text">
                If you have any questions or need assistance getting started, our support team is here to help. Simply reply to this email or visit our help center.
            </p>
            
            <p style="margin-top: 30px; color: #666;">
                Best regards,<br>
                <strong>The Clicarity Team</strong>
            </p>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="social-links">
                <a href="#">📧</a>
                <a href="#">🐦</a>
                <a href="#">👔</a>
                <a href="#">📘</a>
            </div>
            
            <p>
                © 2025 Clicarity. All rights reserved.<br>
                <a href="#">Unsubscribe</a> | <a href="#">Privacy Policy</a> | <a href="#">Terms of Service</a>
            </p>
            
            <p style="font-size: 12px; color: #95a5a6; margin-top: 15px;">
                This email was sent to you because you created an account with Clicarity.<br>
                If you didn't create this account, please contact our support team.
            </p>
        </div>
    </div>
</body>
</html>`;

// Now use it in your function
transporter.sendMail({
    to: `${email}`,
    subject: "Welcome to Clicarity!",
    html: clicartityWelcomeHTML
}).then(() => {
    console.log("Email Send");
}).catch((err) => {
    console.log(err);
});

}