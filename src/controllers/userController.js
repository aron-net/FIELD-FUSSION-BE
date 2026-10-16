const bcrypt = require('bcrypt');

const User = require('../models/User');

const {
  normalizeUgandaPhone,
} = require('../utils/phone');

const {
  successResponse,
  errorResponse,
} = require('../utils/apiResponse');

const sanitizeUser = user => ({
  id: user._id,
  phoneNumber: user.phoneNumber,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  metadata: user.metadata,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ==========================================
// GET CURRENT USER
// GET /api/users/me
// ==========================================

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      'phoneNumber firstName lastName email role isActive metadata createdAt updatedAt',
    );

    if (!user) {
      return errorResponse(
        res,
        404,
        'User account not found.',
      );
    }

    return successResponse(
      res,
      200,
      'User profile retrieved successfully.',
      {
        user: sanitizeUser(user),
      },
    );
  } catch (error) {
    console.error(
      'Get current user error:',
      error,
    );

    return errorResponse(
      res,
      500,
      'Unable to retrieve user profile.',
    );
  }
};

// ==========================================
// UPDATE CURRENT USER
// PUT /api/users/me
// ==========================================

const updateCurrentUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      pin,
      metadata,
    } = req.body;

    if (Object.keys(req.body || {}).length === 0) {
      return errorResponse(
        res,
        400,
        'No update data provided.',
      );
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return errorResponse(
        res,
        404,
        'User account not found.',
      );
    }

    const updateFields = {};

    if (firstName !== undefined) {
      const cleanFirstName = String(firstName).trim();

      if (cleanFirstName.length < 2) {
        return errorResponse(
          res,
          400,
          'First name must contain at least 2 characters.',
        );
      }

      updateFields.firstName = cleanFirstName;
    }

    if (lastName !== undefined) {
      const cleanLastName = String(lastName).trim();

      if (cleanLastName.length < 2) {
        return errorResponse(
          res,
          400,
          'Last name must contain at least 2 characters.',
        );
      }

      updateFields.lastName = cleanLastName;
    }

    if (email !== undefined) {
      if (email !== null && typeof email !== 'string') {
        return errorResponse(
          res,
          400,
          'Email must be a valid email address.',
        );
      }

      const cleanEmail = email ? email.trim().toLowerCase() : '';

      if (
        cleanEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
      ) {
        return errorResponse(
          res,
          400,
          'Email must be a valid email address.',
        );
      }

      updateFields.email = cleanEmail || null;
    }

    if (phoneNumber !== undefined) {
      const normalizedPhone =
        normalizeUgandaPhone(phoneNumber);

      if (!normalizedPhone) {
        return errorResponse(
          res,
          400,
          'Please provide a valid Uganda mobile number.',
        );
      }

      if (normalizedPhone !== user.phoneNumber) {
        const existingUser = await User.findOne({
          phoneNumber: normalizedPhone,
          _id: {$ne: req.userId},
        });

        if (existingUser) {
          return errorResponse(
            res,
            409,
            'This phone number is already registered.',
          );
        }

        updateFields.phoneNumber = normalizedPhone;
      }
    }

    if (pin !== undefined) {
      if (!/^\d{4}$/.test(String(pin))) {
        return errorResponse(
          res,
          400,
          'Security PIN must contain exactly 4 digits.',
        );
      }

      updateFields.pin = await bcrypt.hash(
        String(pin),
        10,
      );
    }

    if (metadata !== undefined) {
      if (
        metadata === null ||
        typeof metadata !== 'object' ||
        Array.isArray(metadata)
      ) {
        return errorResponse(
          res,
          400,
          'Metadata must be an object.',
        );
      }

      updateFields.metadata = metadata;
    }

    if (Object.keys(updateFields).length === 0) {
      return errorResponse(
        res,
        400,
        'No profile fields to update.',
      );
    }

    const updatedUser =
      await User.findByIdAndUpdate(
        req.userId,
        {
          $set: updateFields,
        },
        {
          new: true,
          runValidators: true,
        },
      );

    return successResponse(
      res,
      200,
      'Profile updated successfully.',
      {
        user: sanitizeUser(updatedUser),
      },
    );
  } catch (error) {
    console.error(
      'Profile update error:',
      error,
    );

    return errorResponse(
      res,
      500,
      'Unable to update user profile.',
    );
  }
};

// ==========================================
// DELETE CURRENT USER
// DELETE /api/users/me
// ==========================================

const deleteCurrentUser = async (req, res) => {
  try {
    const deletedUser =
      await User.findByIdAndDelete(req.userId);

    if (!deletedUser) {
      return errorResponse(
        res,
        404,
        'User account not found.',
      );
    }

    return successResponse(
      res,
      200,
      'Account deleted successfully.',
    );
  } catch (error) {
    console.error(
      'Account deletion error:',
      error,
    );

    return errorResponse(
      res,
      500,
      'Unable to delete account.',
    );
  }
};

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser,
};
