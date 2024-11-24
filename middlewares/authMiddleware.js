const JWT = require("jsonwebtoken");
const UserModel = require("../models/UserModel");

// Protected route Token base 
const requireSignIn = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Check if the Authorization header is provided and follows the 'Bearer <token>' format
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: "Authorization token missing or malformed",
            });
        }

        // Extract the token by removing 'Bearer ' prefix
        const token = authHeader.split(' ')[1];

        // Verify the token
        const decoded = JWT.verify(token, process.env.JWT_SECRET_KEY);
        req.user = decoded; // Attach decoded user information (e.g., user ID) to the request

        next(); // Continue to the next middleware or controller
    } catch (error) {
        console.log("Token verification error: ", error);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: "Token has expired.",
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: "Invalid token.",
            });
        } else {
            return res.status(500).json({
                success: false,
                message: "Internal server error.",
            });
        }
    }
};

// Admin middleware 
const isAdmin = async (req, res, next) => {
    try {
        // Find the user based on the ID stored in the decoded token
        const user = await UserModel.findById(req.user.userId); // Ensure the payload has 'userId'

        // Check if the user has an admin role (role == 1)
        if (!user || user.role !== 1) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin privileges required.",
            });
        }

        next(); // Continue if the user is an admin
    } catch (error) {
        console.log("Admin check error: ", error);
        res.status(500).json({
            success: false,
            message: "Server error while checking admin status.",
            error: error.message,
        });
    }
};

module.exports = { requireSignIn, isAdmin };
