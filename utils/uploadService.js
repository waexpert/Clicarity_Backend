const { S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    region: 'eu-north-1',
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    }
});

exports.generateUploadURL = async (fileType = 'application/octet-stream') => {
    try {
        const imageName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        
        const command = new PutObjectCommand({
            Bucket: 'clicarity',
            Key: `userDefinedTaskFiles/${imageName}`,
            ContentType: fileType,
        });
        
        const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 300 });
        console.log("Generated URL:", uploadURL);
        return uploadURL;
    } catch (error) {
        console.error("Error generating URL:", error);
        throw error;
    }
};