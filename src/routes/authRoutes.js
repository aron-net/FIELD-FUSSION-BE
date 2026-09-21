const express = require('express');

const {
  register,
  login,
  forgotPin,
  verifyForgotPinOtp,
  resetPin,
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);

router.post('/login', login);

router.post(
  '/forgot-pin',
  forgotPin,
);

router.post(
  '/verify-forgot-pin-otp',
  verifyForgotPinOtp,
);

router.post(
  '/reset-pin',
  resetPin,
);

module.exports = router;