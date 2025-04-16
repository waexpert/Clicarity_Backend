const ErrorHandler = require('../utils/errorHandler');
const asyncErrorFunction = require('../middleware/asyncErrorFunction');
const User = require('../models/userModel');
const { sendJWTToken } = require('../utils/jwtService');
// const userModel = require('../models/userModel');
const sendEmail = require("../utils/sendEmail");
const cloudinary = require("cloudinary");


// registration of user
exports.registerUser = asyncErrorFunction(async (req, res, err) => {

  const cloud = await cloudinary.v2.uploader.upload(req.body.avatar,{
    folder:"avatars",
    width:150,
    crop:"scale",
  })
  const { name, email, password } = req.body;
  console.log("Hello",name,email,password);
  const user = await User.create({
    name,
    email,
    password,
    avatar: {
      public_id: cloud.public_id,
      url: cloud.secure_url,
    },
  });
  sendJWTToken(user, 201, res);
});

// Login User
exports.loginUser = asyncErrorFunction(async (req, res, next) => {
  const { email, password } = req.body;
  console.log(email,password)

  if (!email || !password) {
    return next(
      new ErrorHandler('Please enter a valid email and password', 400)
    );
  }

   var user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorHandler('Password or Email does not match', 401));
  }

  const isPasswordMatched = user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler('Password or Email does not match', 401));
  }

  sendJWTToken(user, 200, res);
 
});

// Logout
exports.logoutUser = asyncErrorFunction(async (req, res, next) => {
  res.cookie('token', null,{
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.status(200).json({ success: true, message: 'Logout successful' });
});

// forget Password
exports.forgetPassword = asyncErrorFunction(async(req,res,next)=>{

  const user = await User.findOne({email:req.body.email});

  if(!user){
  return next(new ErrorHandler("User doesn't exit provide correct credentials",404));
  }

  // generating token link
const resetToken = await user.getResetPasswordToken();
await user.save({validateBeforeSave:false});
console.log("after generation")
// url for reset Password
const resetPasswordUrl = `${req.protocol}://${req.get("host")}/api/v1/password/reset/${resetToken}`;

const message = `Your password reset token is \n\n ${resetPasswordUrl} If not initiated by you, please ignore `


try{

  await sendEmail({
    email:user.email,
    message:message,
    subject:"Fashniii Password Recovery"
  })
  res.status(200).json({
    success:true,
    message:`Email For Password Recovery send successfuly to ${user.email} `
  })

}catch(err){
  user.resetPasswordToken = undefined;
  user.resetPasswordDate = undefined;

  await user.save({validateBeforeSave:false});
  return next(new ErrorHandler("User doesn't exit provide correct credentials",500))
}


})

// reset password

exports.resetPassword = asyncErrorFunction(async(req,res,next)=>{
  // creating hashed token 
  const resetPasswordToken = crypto.createhash("sha256").update(req.params.token).digest("hex");

  const user = User.findOne({resetPasswordToken,
  resetPasswordDate:{$gt:Date.now()}});

  if(!user){
    return next(new ErrorHandler("Reset Password token is invalid or has expired",400));
  }

  if(req.body.password !== req.body.confirmpassword){
    return next(new ErrorHandler("Password doesn't matched",400))
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordDate = undefined;

  await user.save();

  sendJWTToken(user,200,res)


})


// getUser Details
 exports.getUserDetails = asyncErrorFunction(async(req,res,next)=>{

  const user = await User.findById(req.user.id);

  res.status(200).json({
    success:true,
    user
  })
 })

//  Update password
exports.updatePassword = asyncErrorFunction(async(req,res,next)=>{

  const user = await User.findById(req.user.id).select("+password");
  const isPasswordMatched = await user.comparePassword(req.body.oldPassword);
 

  if(!isPasswordMatched){
    return next(new ErrorHandler("Old Password is incorrect ",400));
  }

  if(req.body.newPassword !== req.body.confirmPassword){
    return next(new ErrorHandler("Password doesn't match",400));
  }

  user.password = req.body.newPassword;
  await user.save()

  sendJWTToken(user,200,res);
})



//  Update profile
exports.updateProfile = asyncErrorFunction(async(req,res,next)=>{

const newUserData = {
  name:req.body.name,
  email:req.body.email
}

const user = await User.findByIdAndUpdate(req.body.id,newUserData,{
  new:true,
  runValidators:true,
  useFindAndModify:false
})

res.status(200).json(
  {
    success:true
  }
)
})

// admin postion 
// get all Users data
exports.getAllUsers = asyncErrorFunction(async(req,res,next)=>{

  const users = await User.find();
  res.status(200).json({
    success:true,
    users
  })
})

// get single users data
exports.getSingleUser = asyncErrorFunction(async(req,res,next)=>{

  const user = await User.find(req.params.id);
  res.status(200).json({
    success:true,
    user
  })
})