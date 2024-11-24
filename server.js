const express = require("express");
const app = express();
const dotenv = require("dotenv");
const morgan = require("morgan");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const path = require("path");
//auth routes
const authRoutes = require("./routes/authRoute");


const cors = require("cors");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Config
dotenv.config();
// Database config
connectDB();
// Middlewares 
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/", (req, res) => {
    res.send("1 2 3 and boom guys");
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Server Running on ${PORT}`);
});
