const Multer = require('multer');

// Multer is required to process file uploads and make them available via
const multer = Multer({
    storage: Multer.memoryStorage(),
    limits: {
        //fileSize: 5 * 1024 * 1024, // no larger than 5mb, you can change as needed.
        fileSize: Infinity
    },
});

// SET STORAGE
const st = Multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'C:\Users\lalo0\Downloads');
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname + '-' + Date.now());
    }
});

module.exports = {
    multer,
    st,
};