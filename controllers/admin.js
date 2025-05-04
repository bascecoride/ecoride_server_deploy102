import User from '../models/User.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError, NotFoundError } from '../errors/index.js';

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    // Support filtering by role, status, etc.
    const { role, approved, search } = req.query;
    const queryObject = {};
    
    if (role) {
      queryObject.role = role;
    }
    
    if (approved === 'true') {
      queryObject.approved = true;
    } else if (approved === 'false') {
      queryObject.approved = false;
    }
    
    if (search) {
      // Search by name, email, or phone
      queryObject.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    console.log('Fetching users with query:', queryObject);
    
    // Exclude admin users from the results
    queryObject.role = { $ne: 'admin' };
    
    const users = await User.find(queryObject).select('-password').sort({ createdAt: -1 });
    
    console.log(`Found ${users.length} users`);
    
    res.status(StatusCodes.OK).json({
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      throw new NotFoundError(`No user found with id ${id}`);
    }
    
    res.status(StatusCodes.OK).json({ user });
  } catch (error) {
    console.error(`Error fetching user ${req.params.id}:`, error);
    
    if (error.name === 'NotFoundError') {
      res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
      return;
    }
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Approve user
export const approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      throw new NotFoundError(`No user found with id ${id}`);
    }
    
    user.status = "approved";
    await user.save();
    
    const updatedUser = await User.findById(id).select('-password');
    
    res.status(StatusCodes.OK).json({
      message: 'User approved successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error(`Error approving user ${req.params.id}:`, error);
    
    if (error.name === 'NotFoundError') {
      res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
      return;
    }
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      message: 'Error approving user',
      error: error.message
    });
  }
};

// Disapprove user
export const disapproveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = await User.findById(id);
    
    if (!user) {
      throw new NotFoundError(`No user found with id ${id}`);
    }
    
    user.status = "disapproved";
    user.disapprovalReason = reason || 'No reason provided';
    await user.save();
    
    const updatedUser = await User.findById(id).select('-password');
    
    res.status(StatusCodes.OK).json({
      message: 'User disapproved successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error(`Error disapproving user ${req.params.id}:`, error);
    
    if (error.name === 'NotFoundError') {
      res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
      return;
    }
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      message: 'Error disapproving user',
      error: error.message
    });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      firstName, 
      middleName, 
      lastName, 
      email, 
      phone, 
      role, 
      sex, 
      schoolId, 
      licenseId, 
      approved 
    } = req.body;
    
    const user = await User.findById(id);
    
    if (!user) {
      throw new NotFoundError(`No user found with id ${id}`);
    }
    
    // Update fields if provided
    if (firstName !== undefined) user.firstName = firstName;
    if (middleName !== undefined) user.middleName = middleName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (schoolId !== undefined) user.schoolId = schoolId;
    if (licenseId !== undefined) user.licenseId = licenseId;
    if (sex !== undefined) user.sex = sex;
    if (approved !== undefined) user.approved = approved;
    
    // Email update requires special handling to check for duplicates
    if (email !== undefined && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        throw new BadRequestError('Email already in use');
      }
      user.email = email;
    }
    
    // Role change requires validation
    if (role !== undefined && role !== user.role) {
      if (!['customer', 'rider'].includes(role)) {
        throw new BadRequestError('Invalid role. Must be customer or rider');
      }
      user.role = role;
    }
    
    await user.save();
    
    const updatedUser = await User.findById(id).select('-password');
    
    res.status(StatusCodes.OK).json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error(`Error updating user ${req.params.id}:`, error);
    
    if (error.name === 'NotFoundError') {
      res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
      return;
    }
    
    if (error.name === 'BadRequestError') {
      res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
      return;
    }
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      message: 'Error updating user',
      error: error.message
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      throw new NotFoundError(`No user found with id ${id}`);
    }
    
    await User.findByIdAndDelete(id);
    
    res.status(StatusCodes.OK).json({
      message: 'User deleted successfully',
      userId: id
    });
  } catch (error) {
    console.error(`Error deleting user ${req.params.id}:`, error);
    
    if (error.name === 'NotFoundError') {
      res.status(StatusCodes.NOT_FOUND).json({ message: error.message });
      return;
    }
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      message: 'Error deleting user',
      error: error.message
    });
  }
};
