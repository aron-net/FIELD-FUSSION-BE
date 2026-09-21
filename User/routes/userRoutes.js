const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'uganda_ezyfarm_secret_vault_key_2026';

// ==========================================
// 1. CREATE: Register New Farmer + Issue Session
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { phoneNumber, pin, firstName, lastName, email, metadata } = req.body;

    if (!phoneNumber || !pin || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Please enter all required fields.' });
    }

    const pinRegex = /^\d{4}$/;
    if (!pinRegex.test(pin.toString())) {
      return res.status(400).json({ success: false, message: 'Security PIN must be exactly 4 digits.' });
    }

    const userExists = await User.findOne({ phoneNumber });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'This phone number is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin.toString(), salt);

    const newUser = new User({
      phoneNumber,
      pin: hashedPin,
      firstName,
      lastName,
      email: email || null,
      metadata: metadata || {}
    });

    await newUser.save();
    
    // 🔑 GENERATE SESSION TOKEN: Signed with the user's ID
    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '30d' }); // Valid for 30 days

    console.log(`Auth Engine: Registered new farmer + issued session: ${phoneNumber}`);
    
    res.status(201).json({ 
      success: true, 
      message: 'Account created successfully.',
      token: token, // 📲 Mobile app saves this token to stay logged in
      user: { id: newUser._id, phoneNumber: newUser.phoneNumber, firstName: newUser.firstName } 
    });

  } catch (error) {
    console.error('Registration Pipeline Error:', error);
    res.status(500).json({ success: false, message: 'Server registration failed.' });
  }
});

// ==========================================
// 2. LOGIN: Authenticate Phone + PIN -> Issue Session
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { phoneNumber, pin } = req.body;

    if (!phoneNumber || !pin) {
      return res.status(400).json({ success: false, message: 'Please enter phone number and PIN.' });
    }

    // Look for the user index row data
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid phone number or PIN.' });
    }

    // Compare the submitted numeric PIN against the encrypted hashed database PIN string
    const isMatch = await bcrypt.compare(pin.toString(), user.pin);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid phone number or PIN.' });
    }

    // 🔑 GENERATE SESSION TOKEN
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    console.log(`Auth Engine: Farmer successfully logged in: ${phoneNumber}`);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token: token,
      user: { id: user._id, phoneNumber: user.phoneNumber, firstName: user.firstName, lastName: user.lastName }
    });

  } catch (error) {
    console.error('Login Pipeline Error:', error);
    res.status(500).json({ success: false, message: 'Server authentication execution failed.' });
  }
});

// ==========================================
// 3. READ: Fetch Farmer Profile Details
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-pin');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Farmer profile not found.' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Profile Fetch Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user profile.' });
  }
});

// ==========================================
// 4. UPDATE: Update Full Farmer Profile Info
// ==========================================
router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, pin, metadata } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Farmer profile not found.' });
    }

    let updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (email !== undefined) updateFields.email = email || null;
    if (metadata) updateFields.metadata = metadata;

    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      const phoneConflict = await User.findOne({ phoneNumber });
      if (phoneConflict) {
        return res.status(400).json({ success: false, message: 'This phone number is already taken.' });
      }
      updateFields.phoneNumber = phoneNumber;
    }

    if (pin) {
      const pinRegex = /^\d{4}$/;
      if (!pinRegex.test(pin.toString())) {
        return res.status(400).json({ success: false, message: 'New security PIN must be exactly 4 digits.' });
      }
      const salt = await bcrypt.genSalt(10);
      updateFields.pin = await bcrypt.hash(pin.toString(), salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-pin');

    res.status(200).json({ success: true, message: 'Profile updated successfully.', user: updatedUser });

  } catch (error) {
    console.error('Profile Update Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user profile.' });
  }
});

// ==========================================
// 5. DELETE: De-register Farmer Account
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: 'Farmer profile not found.' });
    }
    res.status(200).json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Account Deletion Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account.' });
  }
});

module.exports = router;
