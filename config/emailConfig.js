// emailConfig.js
const nodemailer = require('nodemailer');

// Create reusable transporter function
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,  // Set to 'false' for STARTTLS
        auth: {
            user: process.env.AUTH_EMAIL_P,
            pass: process.env.AUTH_PASSWORD_P
        },
        requireTLS: true,  // Ensure STARTTLS is enabled
        logger: true,      // Log to console
        debug: true        // Show SMTP traffic in the console
    });
};

module.exports = createTransporter;
