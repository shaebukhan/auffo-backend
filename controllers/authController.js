const { hashPassword, comparePassword, generateTokenAndSetCookie, getFormattedDateTime, generateRandomString } = require("../helpers/authHelper");
const UserModel = require("../models/UserModel");
const JWT = require("jsonwebtoken");
const nodemailer = require('nodemailer');
const crypto = require("crypto");
const createTransporter = require("../config/emailConfig");

//Register 
const registerController = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name) {
            return res.send({ message: "Name is Required" });
        }
        if (!email) {
            return res.send({ message: "Email is Required" });
        }
        if (!password) {
            return res.send({ message: "Password is Required" });
        }

        // Check if the user already exists
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return res.status(200).send({
                success: false,
                message: "Email Already Registered !! Please Login"
            });
        }

        // Hash the password
        const hashedPassword = await hashPassword(password);
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        // Generate OTP and timeotp


        // Create the new user
        const user = await new UserModel({
            name,
            email,
            password: hashedPassword,
            verificationToken,
            verificationTokenExpiresAt: Date.now() + 10 * 60 * 1000,

        }).save();
        const token = await generateTokenAndSetCookie(res, user._id);
        // console.log(token);

        // Send OTP via email
        await sendOtpEmail(email, name, verificationToken);
        const protect = generateRandomString(20);
        res.status(201).send({
            success: true,
            message: "Account Created  Successfully. Please check your email for the OTP.",
            user,
            token,
            protect
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error in Registration",
            error
        });
    }
};
//again otp 
const otpSendController = async (req, res) => {

    try {

        const { email } = req.body;

        if (!email) {
            return res.status(400).send({ message: "Email is Required" });
        }

        // check email and answer 
        const user = await UserModel.findOne({ email });
        //validation 
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "Email Not Found"
            });
        }

        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        // Generate OTP and timeotp
        const vte = Date.now() + 10 * 60 * 1000;
        user.verificationToken = verificationToken,
            user.verificationTokenExpiresAt = vte;
        await user.save();
        // Send OTP via email
        await sendOtpEmail(email, user.name, verificationToken);


        res.status(201).send({
            success: true,
            message: `OTP Send again to ${user.email} . Please check your email for the OTP.`,
            user,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error in Sending OTP",
            error
        });
    }


};
//change email controller
const changeEmailController = async (req, res) => {
    try {
        const { email, oldemail } = req.body;

        // Check if both old and new email are provided
        if (!email || !oldemail) {
            return res.status(400).send({ message: "email is required." });
        }
        if (email === oldemail) {
            return res.status(200).send({
                success: false,
                message: "New Email and Old email Can not be same"
            });
        }

        const alreadyEmail = await UserModel.findOne({ email });
        if (alreadyEmail) {
            return res.status(200).send({
                success: false,
                message: "Email Already Registered"
            });
        }
        // Find user by the old email
        const user = await UserModel.findOne({ email: oldemail });

        // Validation: Check if user exists
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found."
            });
        }

        // Generate OTP and its expiration time
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationTokenExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

        // Update user's email to new email
        user.email = email;
        user.verificationToken = verificationToken;
        user.verificationTokenExpiresAt = verificationTokenExpiresAt;

        // Save the updated user information
        await user.save();

        // Send OTP via email to the new email address
        await sendOtpEmail(email, user.name, verificationToken);

        // Respond with success message
        res.status(200).send({
            success: true,
            message: `OTP sent to new Email ${email}. Please check your new email for verification.`,
            user
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({
            success: false,
            message: "Error in updating email and sending OTP.",
            error
        });
    }
};

//Verify Email
const verifyEmailController = async (req, res) => {
    const { code } = req.body;
    try {
        // Check if the user already exists
        const user = await UserModel.findOne({
            verificationToken: code,
            verificationTokenExpiresAt: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(200).send({
                success: false,
                message: "Invalid or expired verification code !!"
            });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiresAt = undefined;
        await user.save();

        await sendWelcomeEmail(user.email, user.name);
        const token = await generateTokenAndSetCookie(res, user._id);
        // Send OTP via email
        res.status(201).send({
            success: true,
            message: "Email verified successfully.",
            user,
            token
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error in Verification Email",
            error
        });
    }

};
// LOGIN 
const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email and password are provided
        if (!email || !password) {
            return res.status(400).send({
                success: false,
                message: "Email and Password are required",
            });
        }

        // Find user by email
        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "Email not found",
            });
        }

        // Check if the account is blocked
        if (user.status === 1) {
            return res.status(403).send({
                success: false,
                message: "Account Blocked. Please contact Customer Support for further help.",
            });
        }

        // Check if the account is verified
        if (!user.isVerified) {
            // Generate a new OTP and expiration time
            const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
            user.verificationToken = verificationToken;
            user.verificationTokenExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
            await user.save();

            // Send OTP via email
            await sendOtpEmail(email, user.name, verificationToken);

            return res.status(401).send({
                success: false,
                message: "Account not verified. OTP has been sent to your email. Please verify your account.",
            });
        }

        // Check if password matches
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(401).send({
                success: false,
                message: "Invalid Credentials",
            });
        }

        // Generate JWT token
        const token = await generateTokenAndSetCookie(res, user._id);
        const { date, time } = getFormattedDateTime();
        await sendLoginEmail(user.email, user.name, time, date);
        // Successful login response
        res.status(200).send({
            success: true,
            message: "Logged in Successfully!",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            token,
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send({
            success: false,
            message: "Error during login",
            error: error.message,
        });
    }
};



//logout 
const logoutController = async (req, res) => {
    res.clearCookie("token");
    res.status(201).send({
        success: true,
        message: "Logged out successfully!",

    });
};
//forgot password Controller 

const forgotPasswordController = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(200).send({
                success: false,
                message: "Email is Required"
            });
        }

        // check email and answer 
        const user = await UserModel.findOne({ email });
        //validation 
        if (!user) {
            return res.status(200).send({
                success: false,
                message: "Email Not Found"
            });
        }
        const resetToken = crypto.randomBytes(20).toString("hex");
        const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpiresAt = resetTokenExpiresAt;

        await user.save();
        await forgotPasswordEmail(user.email, user.name, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);

        return res.status(200).send({
            success: true,
            message: "Password reset link sent to your email !"
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error in sending rest password link",
            error
        });
    }
};
//reset password controller
const resetPasswordController = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        // check email and answer 
        const user = await UserModel.findOne({
            resetPasswordToken: token,
            resetPasswordExpiresAt: { $gt: Date.now() },
        }
        );
        //validation 
        if (!user) {
            return res.status(200).send({
                success: false,
                message: "Invalid Token or Reset Link Expired !!"
            });
        }

        // Hash the password
        const hashedPassword = await hashPassword(password);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiresAt = undefined;
        await user.save();
        const { date, time } = getFormattedDateTime();
        await resetPasswordEmail(user.email, user.name, time, date);

        return res.status(200).send({
            success: true,
            message: "Password Changed Successfully !"
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error in changing password ",
            error
        });
    }
};
//check auth 


const checkAuth = async (req, res) => {
    try {
        const user = await UserModel.findById(req.userId).select("-password");
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.log("Error in checkAuth ", error);
        res.status(400).json({ success: false, message: error.message });
    }
};


const getAlluserController = async (req, res) => {
    try {
        // Find all users with role == 0 and exclude the password field
        const users = await UserModel.find({ role: 0 }).select("-password");


        if (!users || users.length === 0) {
            return res.status(204).json({ success: false, message: "No users found" });
        }

        res.status(200).json({ success: true, users });
    } catch (error) {
        console.log("Error in getting users: ", error);
        res.status(400).json({ success: false, message: error.message });
    }
};


const getAllVerifiedUserController = async (req, res) => {
    try {
        // Find all users with role == 0 and exclude the password field
        const users = await UserModel.find({
            role: 0,
            kycstatus: 2,
            status: 0,
            isVerified: true
        }).select("-password");


        if (!users || users.length === 0) {
            return res.status(204).json({ success: false, message: "No users found" });
        }

        res.status(200).json({ success: true, users });
    } catch (error) {
        console.log("Error in getting users: ", error);
        res.status(400).json({ success: false, message: error.message });
    }
};


const profileUpdateController = async (req, res) => {

    try {
        const { id } = req.params; // Extract the user ID from the route parameter
        const { name, email, password } = req.body; // Extract fields from request body

        // Find the user by ID
        const user = await UserModel.findById(id);

        if (!user) {
            return res.status(204).json({ success: false, message: 'Account not found' });
        }

        // Update name and email
        user.name = name;
        user.email = email;

        // If password is provided, hash and update it
        if (password) {
            const hashedPassword = await hashPassword(password);

            user.password = hashedPassword;
        }

        // Save the updated user data
        await user.save();

        // Respond with success
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                name: user.name,
                email: user.email,
            },
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }

};

//add account by admin

const addUserAdminController = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name) {
            return res.send({ message: "Name is Required" });
        }
        if (!email) {
            return res.send({ message: "Email is Required" });
        }
        if (!password) {
            return res.send({ message: "Password is Required" });
        }

        // Check if the user already exists
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return res.status(200).send({
                success: false,
                message: "Email Already Registered !!"
            });
        }

        // Hash the password
        const hashedPassword = await hashPassword(password);


        // Create the new user
        const user = await new UserModel({
            name,
            email,
            password: hashedPassword,
            isVerified: true,

        }).save();

        res.status(201).send({
            success: true,
            message: "User Added  Successfully !",
            user,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error in Adding user",
            error
        });
    }
};

//get single user

const getSingleUserController = async (req, res) => {
    try {
        const { id } = req.params; // Extract the user ID from the route parameter

        // Find the user by ID
        const user = await UserModel.findById(id);

        if (!user) {
            return res.status(204).json({ success: false, message: 'Account not found' });
        }

        // Respond with success
        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

//update user

const userUpdateController = async (req, res) => {
    try {
        const { id } = req.params; // Extract the user ID from the route parameter
        const { name, email, password, status } = req.body; // Extract fields from request body

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'Name and email are required.' });
        }

        // Validate email format (basic validation)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format.' });
        }

        // Validate status if provided
        if (status !== undefined) {
            if (![0, 1].includes(status)) {
                return res.status(400).json({ success: false, message: 'Invalid status value. Must be 0 (Active) or 1 (Locked).' });
            }
        }

        // Find the user by ID
        const user = await UserModel.findById(id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        // Update name and email
        user.name = name;
        user.email = email;

        // If password is provided, hash and update it
        if (password) {
            // Assuming hashPassword is a function that hashes the password
            const hashedPassword = await hashPassword(password);
            user.password = hashedPassword;
        }

        // If status is provided, update it
        if (status !== undefined) {
            user.status = status;
        }

        // Save the updated user data
        await user.save();

        // Respond with success and the updated user data
        res.json({
            success: true,
            message: 'Profile updated successfully.',
            user: {
                name: user.name,
                email: user.email,
                status: user.status, // Include status in the response
            },
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};





// Function to send OTP via email
const sendOtpEmail = async (email, name, verificationToken) => {
    // Configure the email transport using nodemailer
    const transporter = createTransporter();


    // Email options
    const mailOptions = {
        from: process.env.AUTH_EMAIL_P,
        to: email,
        subject: 'Verify Your Account with AUFFO',
        html: `<div style="background: #0E2340; text-align: center;">
    <h1 style="font-size: 45px; font-weight: bold; background: #0E2340; color: #fff; padding: 10px 0px;">
        AUFFO
    </h1>
</div>
<div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p style="color: #333; font-size: 17px;">
        Hi <span style="text-transform: uppercase;">${name}</span>,
    </p>
    <p style="color: #333; font-size: 17px;">
        Thank you for joining AUFFO. Please verify your email by using the below code to complete your registration.
    </p>
    <div style="color: #0E2340; display: inline-block; padding: 10px 20px; border-radius: 4px; font-size: 30px; letter-spacing: 1.5px;">
        <strong>${verificationToken}</strong>
    </div>
    <p style="color: #333; font-size: 17px; margin-bottom: 5px;">
        Please use the OTP to complete your registration process. This OTP is valid for 10 minutes.
    </p>
    <h5 style="font-size: 17px; margin: 0;">
        Best regards,<br>AUFFO Team
    </h5>
</div>
<div style="text-align: center; margin-top: 20px; color: #888; font-size: 13px;">
    <h6>This is an automated message, please do not reply to this email.</h6>
</div>
`
    };


    // Send the email
    await transporter.sendMail(mailOptions);
};


const sendWelcomeEmail = async (email, name) => {
    // Configure the email transport using nodemailer
    const transporter = createTransporter();


    // Email options
    const mailOptions = {
        from: process.env.AUTH_EMAIL_P,
        to: email,
        subject: 'Welcome to AUFFO',
        html: `<div style="background: #0E2340; text-align: center;">
    <h1 style="font-size: 45px; font-weight: bold; color: #fff; padding: 10px 0;">
        AUFFO
    </h1>
</div>
<div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);">
    <h5 style="color: #333; font-size: 17px;">
        Dear! <strong style="text-transform: capitalize;">${name}</strong>,
    </h5>
    <h5 style="color: #333; font-size: 17px; margin-top: 10px;">
        Your account has successfully been verified. Please use the link below to access the dashboard.
    </h5>
    <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/dashboard/user" 
           style="font-size: 17px; font-weight: bold; background: #0E2340; color: #fff; padding: 10px 30px; border-radius: 5px; text-decoration: none;">
            Dashboard
        </a>
    </div>
    <h5 style="font-size: 17px; color: #333; margin-top: 20px;">
        Best regards,<br>AUFFO Team
    </h5>
</div>
<div style="text-align: center; margin-top: 20px; color: #888; font-size: 13px;">
    <h6>This is an automated message, please do not reply to this email.</h6>
</div>
`
    };

    // Send the email
    await transporter.sendMail(mailOptions);
};


const forgotPasswordEmail = async (email, name, resetToken) => {
    // Configure the email transport using nodemailer
    const transporter = createTransporter();

    // Email options
    const mailOptions = {
        from: process.env.AUTH_EMAIL_P,
        to: email,
        subject: 'Reset Your Password',
        html: `<div style="background: #0E2340; padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">AUFFO</h1>
</div>
<div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h5 style="font-size:20px">  Hi <span style="text-transform:uppercase;">${name}</span>,</h5>
    <p style="font-size:17px">it looks like you requested to reset your password. Click on the link below to create a new password. If you didn’t make this request, please ignore this email.</p>
    <div style="text-align: center; margin: 30px 0;">
        <a href="${resetToken}" style="font-size: 20px; font-weight: bold; background: #0E2340; color: #fff; padding: 10px 30px; border-radius: 5px; text-decoration: none;">Reset your password</a>
    </div>
    
    <h5 style="font-size:17px">Best regards,<br>AUFFO Team</h5>
     
</div>
<div style="text-align: center; margin-top: 20px; color: #888; font-size: 13px;">
    <p>This is an automated message, please do not reply to this email.</p>
</div>
`
    };

    // Send the email
    await transporter.sendMail(mailOptions);
};

const resetPasswordEmail = async (email, name, time, date) => {
    // Configure the email transport using nodemailer
    const transporter = createTransporter();


    // Email options
    const mailOptions = {
        from: process.env.AUTH_EMAIL_P,
        to: email,
        subject: 'AUFFO Alert',
        html: `<div style="background: #0E2340; padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">AUFFO</h1>
</div>
<div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <h5 style="font-size:20px">Dear <span style="text-transform:uppercase;">${name}</span>,</h5>
    <p style="font-size:17px">You have successfully changed  your password  at <strong>${time}</strong> on <strong>${date}</strong>.</p>
    <p style="font-size:17px">If you do not recognize this  attempt, please immediately  contact us to block the  services.</p>
    <p style="font-size:17px">Please note that  AUFFO will never ask for any confidential information by calling from any number including its official helpline numbers, through emails or websites! Please do not share your confidential details such as  CVV, User Name, Password, OTP etc.</p>
    <p>In case of any complaint, you may contact us through:</p>
     <ul>
                    <li style="font-size:17px">Email: <a href="mailto:support@pqs.com">support@pqs.com</a></li>
                    <li style="font-size:17px">Phone: <a href="tel:+442071675747">+44 2071675747</a></li>
                    <li style="font-size:17px">Websites: <a href="https://www.pqs.com/complaint-form/">www.pqs.com/complaint-form/</a></li>
                </ul>
</div>
<div style="text-align: center; margin-top: 20px; color: #888; font-size: 13px;">
    <p>This is an automated message, please do not reply to this email.</p>
</div>
`
    };

    // Send the email
    await transporter.sendMail(mailOptions);
};
const sendLoginEmail = async (email, name, time, date) => {
    try {
        // Configure the email transport using nodemailer

        const transporter = createTransporter();



        // Email options
        const mailOptions = {
            from: process.env.AUTH_EMAIL_P,
            to: email,
            subject: 'AUFFO Alert',
            html: `<div style="background: #0E2340; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">AUFFO</h1>
            </div>
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <h5 style="font-size:20px">Dear <span style="text-transform:uppercase;">${name}</span>,</h5>
                <p style="font-size:17px">You have  successfully logged in to AUFFO  at <strong>${time}</strong> on <strong>${date}</strong>.</p>
                <p style="font-size:17px">If you do not recognize this login attempt, please immediately Login to our Website  </strong> to block the  services.</p>
                <p style="font-size:17px">Please note that PQS will never ask for any confidential information by calling from any number including its official helpline numbers, through emails or websites! Please do not share your confidential details such as  CVV, User Name, Password, OTP etc.</p>
                <p>In case of any complaint, you may contact us through:</p>
                <ul>
                    <li style="font-size:17px">Email: <a href="mailto:support@pqs.com">support@pqs.com</a></li>
                    <li style="font-size:17px">Phone: <a href="tel:+442071675747">+44 2071675747</a></li>
                    <li style="font-size:17px">Websites: <a href="https://www.pqs.com/complaint-form/">www.pqs.com/complaint-form/</a></li>
                </ul>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #888; font-size: 13px;">
                <p>This is an automated message, please do not reply to this email.</p>
            </div>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log('Error occurred:', error.message);
            }
            console.log('Message sent: %s', info.messageId);
        });
    } catch (error) {
        console.error('Error sending email:', error); // Log the error
        throw new Error('Failed to send email'); // Optional: Throw an error to propagate it further
    }
};



//Test controller 
const testController = (req, res) => {
    res.send("Protected Route");
};


module.exports = {
    registerController, loginController, testController, forgotPasswordController, verifyEmailController, logoutController,
    resetPasswordController, checkAuth, otpSendController, changeEmailController
    , getAlluserController, profileUpdateController, addUserAdminController, getSingleUserController, userUpdateController, getAllVerifiedUserController
};