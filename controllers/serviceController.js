const { generateUploadURL } = require("../utils/uploadService");

exports.uploadFile = async (req, res) => {
    try {
        const fileType = req.query.fileType || 'application/octet-stream';
        
        const url = await generateUploadURL(fileType);
        console.log("Returning URL:", url);
        
        res.status(200).json({ message: url });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
};