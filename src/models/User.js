const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    pin: {
      type: String,
      required: true,
      select: false,
    },

    // Forgot PIN fields
    resetPinOtp: {
      type: String,
      select: false,
    },

    resetPinOtpAttempts: {
      type: Number,
      default: 0,
    },

    resetPinLockedUntil: {
      type: Date,
      default: null,
    },

    resetPinOtpExpiresAt: {
      type: Date,
    },

    resetPinOtpLastSentAt: {
      type: Date,
      default: null,
    },

    resetPinVerified: {
      type: Boolean,
      default: false,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },

    role: {
      type: String,
      enum: ['FARMER', 'ADMIN'],
      default: 'FARMER',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('User', UserSchema);
