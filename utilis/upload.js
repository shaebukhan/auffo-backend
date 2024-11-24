const multer = require('multer');

// Use memory storage to temporarily hold the files
const storage = multer.memoryStorage();

// File filter to validate image and PDF MIME types
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image') || file.mimetype === 'application/pdf') {
        cb(null, true); // Accept file
    } else {
        cb(new Error('File type not supported. Only images and PDFs are allowed.'), false); // Reject file
    }
};

// Configure multer
const upload = multer({
    storage: storage, // Store files temporarily in memory
    fileFilter: fileFilter
});



module.exports = upload;
