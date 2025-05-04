import User from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import jwt from "jsonwebtoken";

// Simple test endpoint
export const testAuth = async (req, res) => {
  res.status(StatusCodes.OK).json({ message: "Auth endpoint is working" });
};

// Login with email and password
export const login = async (req, res) => {
  const { email, password, role } = req.body;

  console.log("Login attempt:", { email, role }); // Log login attempt details

  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }

  if (!role || !["customer", "rider", "admin"].includes(role)) {
    throw new BadRequestError("Valid role is required (customer, rider, or admin)");
  }

  try {
    // Find user without role restriction first to debug
    const anyUser = await User.findOne({ email });
    console.log("User found with this email:", anyUser ? "Yes" : "No");
    if (anyUser) {
      console.log("User role:", anyUser.role, "Requested role:", role);
    }

    const user = await User.findOne({ email, role });
    
    if (!user) {
      console.log("User not found with email and role combination");
      throw new UnauthenticatedError("Invalid credentials");
    }

    console.log("User found, checking password");
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      console.log("Password incorrect");
      throw new UnauthenticatedError("Invalid credentials");
    }

    // Check if user is approved (skip for admin users)
    if (role !== 'admin') {
      if (user.status === "disapproved") {
        console.log("User is disapproved");
        return res.status(StatusCodes.FORBIDDEN).json({
          message: "Your account has been disapproved. Please contact support for assistance.",
          status: "disapproved",
          isApproved: false
        });
      } else if (user.status === "pending") {
        console.log("User is pending approval");
        return res.status(StatusCodes.FORBIDDEN).json({
          message: "Your account is pending approval. Please wait for an administrator to approve your account.",
          status: "pending",
          isApproved: false
        });
      }
    }

    console.log("Password correct, generating tokens");
    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    return res.status(StatusCodes.OK).json({
      message: "User logged in successfully",
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Register a new user
export const register = async (req, res) => {
  const { 
    email, 
    password, 
    role, 
    firstName, 
    middleName, 
    lastName, 
    phone, 
    schoolId,
    licenseId,
    sex
  } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }

  if (!role || !["customer", "rider"].includes(role)) {
    throw new BadRequestError("Valid role is required (customer or rider)");
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new BadRequestError("Email already in use");
    }

    // Format licenseId if provided and user is a rider
    let formattedLicenseId = licenseId;
    if (role === "rider" && licenseId) {
      formattedLicenseId = licenseId.trim().toUpperCase();
      
      // Basic validation for license ID format
      if (formattedLicenseId.length < 4) {
        throw new BadRequestError("License ID must be at least 4 characters");
      }
    }

    // Create new user
    const user = new User({
      email,
      password,
      role,
      firstName,
      middleName,
      lastName,
      phone,
      schoolId,
      licenseId: formattedLicenseId,
      sex,
      approved: false, // Ensure all new users start as unapproved
      status: "pending"
    });

    await user.save();

    // Generate tokens but inform user that approval is pending
    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    res.status(StatusCodes.CREATED).json({
      message: "User registered successfully. Your account is pending approval.",
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
      isApproved: false,
      status: "pending"
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Legacy phone-based authentication (keeping for backward compatibility)
export const auth = async (req, res) => {
  const { phone, role } = req.body;

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  if (!role || !["customer", "rider"].includes(role)) {
    throw new BadRequestError("Valid role is required (customer or rider)");
  }

  try {
    let user = await User.findOne({ phone });

    if (user) {
      if (user.role !== role) {
        throw new BadRequestError("Phone number and role do not match");
      }

      // Check if user is approved
      if (user.status === "disapproved") {
        console.log("User is disapproved");
        return res.status(StatusCodes.FORBIDDEN).json({
          message: "Your account has been disapproved. Please contact support for assistance.",
          status: "disapproved",
          isApproved: false
        });
      } else if (user.status === "pending") {
        console.log("User is pending approval");
        return res.status(StatusCodes.FORBIDDEN).json({
          message: "Your account is pending approval. Please wait for an administrator to approve your account.",
          status: "pending",
          isApproved: false
        });
      }

      const accessToken = user.createAccessToken();
      const refreshToken = user.createRefreshToken();

      return res.status(StatusCodes.OK).json({
        message: "User logged in successfully",
        user,
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    user = new User({
      phone,
      role,
      // Set a temporary email and password for legacy users
      email: `${phone}@temp.ecoride.com`,
      password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8),
      // Set approved to false by default
      approved: false,
      status: "pending"
    });

    await user.save();

    // Return pending status for new users
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "Account pending approval",
      status: "pending",
      isApproved: false,
      user: {
        _id: user._id,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    throw new BadRequestError("Refresh token is required");
  }

  try {
    const payload = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.id);

    if (!user) {
      throw new UnauthenticatedError("Invalid refresh token");
    }

    const newAccessToken = user.createAccessToken();
    const newRefreshToken = user.createRefreshToken();

    res.status(StatusCodes.OK).json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error(error);
    throw new UnauthenticatedError("Invalid refresh token");
  }
};

// Get user profile information
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      throw new UnauthenticatedError("User not found");
    }

    res.status(StatusCodes.OK).json({
      user
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Update user profile information
export const updateUserProfile = async (req, res) => {
  const { firstName, middleName, lastName, phone, schoolId, licenseId, email, sex } = req.body;

  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      throw new UnauthenticatedError("User not found");
    }

    // Update fields if provided
    if (firstName) user.firstName = firstName;
    if (middleName !== undefined) user.middleName = middleName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (schoolId !== undefined) user.schoolId = schoolId;
    
    // Format and validate licenseId if provided and user is a rider
    if (licenseId !== undefined) {
      if (user.role === "rider" && licenseId) {
        const formattedLicenseId = licenseId.trim().toUpperCase();
        
        // Basic validation for license ID format
        if (formattedLicenseId.length < 4) {
          throw new BadRequestError("License ID must be at least 4 characters");
        }
        
        user.licenseId = formattedLicenseId;
      } else {
        user.licenseId = licenseId;
      }
    }
    
    if (sex) user.sex = sex;
    if (email) {
      // Check if email is already in use by another user
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existingUser) {
        throw new BadRequestError("Email already in use");
      }
      user.email = email;
    }

    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(req.user.id).select('-password');

    res.status(StatusCodes.OK).json({
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};
