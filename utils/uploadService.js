const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    region: 'eu-north-1', 
    signatureVersion: 'v4', 
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ,
    }
})

export async function generateUploadURL(fileType = 'application/octet-stream') {
    try {
        const imageName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        
        const params = {
            Bucket: 'clicarity',
            Key: `userDefinedTaskFiles/${imageName}`,
            Expires: 300,
            ContentType: fileType, 
        }
        
        const uploadURL = await s3.getSignedUrlPromise('putObject', params)
        console.log("Generated URL:", uploadURL)
        return uploadURL
    } catch (error) {
        console.error("Error generating URL:", error)
        throw error
    }
}