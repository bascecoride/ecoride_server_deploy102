import express from 'express';
import { refreshToken, auth, login, register, testAuth, getUserProfile, updateUserProfile } from '../controllers/auth.js';
import authenticateUser from '../middleware/authentication.js';
import User from '../models/User.js';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.get('/', testAuth);
router.post('/refresh-token', refreshToken);
router.post('/signin', auth); // Legacy endpoint
router.post('/login', login); // New email/password login
router.post('/register', register); // New registration endpoint
router.get('/profile', authenticateUser, getUserProfile); // Get user profile
router.put('/profile', authenticateUser, updateUserProfile); // Update user profile

// Special admin login endpoint
router.post('/admin-login', async (req, res) => {
  const { email, password } = req.body;
  
  console.log('Admin login attempt:', email);
  
  try {
    // Find admin user by email
    const admin = await User.findOne({ email, role: 'admin' });
    
    if (!admin) {
      console.log('Admin not found with email:', email);
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isPasswordCorrect = await admin.comparePassword(password);
    if (!isPasswordCorrect) {
      console.log('Incorrect password for admin');
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
    }
    
    // Generate tokens
    const accessToken = admin.createAccessToken();
    const refreshToken = admin.createRefreshToken();
    
    console.log('Admin login successful');
    
    return res.status(StatusCodes.OK).json({
      message: 'Admin logged in successfully',
      user: admin,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      message: 'Error during admin login',
      error: error.message
    });
  }
});

export default router;
