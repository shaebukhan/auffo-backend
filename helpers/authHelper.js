const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");
const hashPassword = async (password) => {
    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (error) {
        console.log(error);
    }
};

const comparePassword = async (password, hash) => {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
};

const generateTokenAndSetCookie = async (res, userId) => {
    const isProduction = process.env.NODE_ENV === "production";

    const token = JWT.sign({ userId }, process.env.JWT_SECRET_KEY, {
        expiresIn: "24h", // Token expiration set to 1 day
    });

    res.cookie("token", token, {
        httpOnly: true, // Prevent client-side access to the token
        secure: true, // Use true to enforce HTTPS
        sameSite: "None", // Allows the cookie to be sent in cross-domain requests
        path: "/", // Ensure the cookie is accessible across the entire site
        maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
    });


    return token;
};


function getFormattedDateTime() {
    const now = new Date();

    // Options for formatting date and time
    const optionsDate = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };

    // Format date and time
    const date = now.toLocaleDateString('en-US', optionsDate);
    const time = now.toLocaleTimeString('en-US', optionsTime);

    return { date, time };
}

const { date, time } = getFormattedDateTime();

const crypto = require('crypto');

function generateRandomString(length) {
    return crypto.randomBytes(length)
        .toString('base64') // You can use 'hex', 'base64', etc.
        .slice(0, length);  // Trim to the desired length
}




module.exports = {
    hashPassword,
    comparePassword,
    generateTokenAndSetCookie,
    getFormattedDateTime,
    generateRandomString
};

