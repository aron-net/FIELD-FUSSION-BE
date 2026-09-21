const bcrypt = require('bcrypt');
const crypto = require('crypto');

const jwt = require('jsonwebtoken');

const User = require('../models/User');

const { normalizeUgandaPhone } = require('../utils/phone');

const {
    successResponse,
    errorResponse,
} = require('../utils/apiResponse');

const generateToken = userId => {
    return jwt.sign(
        {
            id: userId,
        },
        process.env.JWT_SECRET,
        {
            expiresIn:
                process.env.JWT_EXPIRES_IN || '30d',
        },
    );
};

const sanitizeUser = user => {
    return {
        id: user._id,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};

// ==========================================
// REGISTER
// POST /api/auth/register
// ==========================================

const register = async (req, res) => {
    try {
        const {
            phoneNumber,
            pin,
            firstName,
            lastName,
            email,
            metadata,
        } = req.body;

        if (
            !phoneNumber ||
            !pin ||
            !firstName ||
            !lastName
        ) {
            return errorResponse(
                res,
                400,
                'Phone number, PIN, first name and last name are required.',
            );
        }

        const normalizedPhone =
            normalizeUgandaPhone(phoneNumber);

        if (!normalizedPhone) {
            return errorResponse(
                res,
                400,
                'Please provide a valid Uganda mobile number.',
            );
        }

        if (!/^\d{4}$/.test(String(pin))) {
            return errorResponse(
                res,
                400,
                'Security PIN must contain exactly 4 digits.',
            );
        }

        const cleanFirstName =
            String(firstName).trim();

        const cleanLastName =
            String(lastName).trim();

        if (cleanFirstName.length < 2) {
            return errorResponse(
                res,
                400,
                'First name must contain at least 2 characters.',
            );
        }

        if (cleanLastName.length < 2) {
            return errorResponse(
                res,
                400,
                'Last name must contain at least 2 characters.',
            );
        }

        // Email is optional.
        // Empty string / spaces are stored as null.
        const cleanEmail =
            email !== undefined &&
                email !== null
                ? String(email)
                    .trim()
                    .toLowerCase()
                : '';

        const existingUser =
            await User.findOne({
                phoneNumber: normalizedPhone,
            });

        if (existingUser) {
            return errorResponse(
                res,
                409,
                'This phone number is already registered.',
            );
        }

        const hashedPin =
            await bcrypt.hash(
                String(pin),
                10,
            );

        const user = await User.create({
            phoneNumber: normalizedPhone,
            pin: hashedPin,
            firstName: cleanFirstName,
            lastName: cleanLastName,

            // Optional email.
            // "" / "   " becomes null.
            email: cleanEmail || null,

            metadata: metadata || {},
        });

        const token =
            generateToken(user._id);

        console.log(
            `Auth: New farmer registered ${normalizedPhone}`,
        );

        return successResponse(
            res,
            201,
            'Account created successfully.',
            {
                token,
                user: sanitizeUser(user),
            },
        );
    } catch (error) {
        console.error(
            'Registration error:',
            error,
        );

        // MongoDB duplicate-key protection.
        if (error?.code === 11000) {
            return errorResponse(
                res,
                409,
                'This phone number is already registered.',
            );
        }

        return errorResponse(
            res,
            500,
            'Unable to create your account.',
        );
    }
};

// ==========================================
// LOGIN
// POST /api/auth/login
// ==========================================

const login = async (req, res) => {
    try {
        const {
            phoneNumber,
            pin,
        } = req.body;

        if (!phoneNumber || !pin) {
            return errorResponse(
                res,
                400,
                'Phone number and PIN are required.',
            );
        }

        const normalizedPhone =
            normalizeUgandaPhone(phoneNumber);

        if (!normalizedPhone) {
            return errorResponse(
                res,
                400,
                'Please provide a valid Uganda mobile number.',
            );
        }

        if (!/^\d{4}$/.test(String(pin))) {
            return errorResponse(
                res,
                400,
                'PIN must contain exactly 4 digits.',
            );
        }

        const user =
            await User.findOne({
                phoneNumber:
                    normalizedPhone,
            }).select('+pin');

        if (!user || !user.isActive) {
            return errorResponse(
                res,
                401,
                'Invalid phone number or PIN.',
            );
        }

        const validPin =
            await bcrypt.compare(
                String(pin),
                user.pin,
            );

        if (!validPin) {
            return errorResponse(
                res,
                401,
                'Invalid phone number or PIN.',
            );
        }

        const token =
            generateToken(user._id);

        console.log(
            `Auth: Farmer login ${normalizedPhone}`,
        );

        return successResponse(
            res,
            200,
            'Login successful.',
            {
                token,
                user: sanitizeUser(user),
            },
        );
    } catch (error) {
        console.error(
            'Login error:',
            error,
        );

        return errorResponse(
            res,
            500,
            'Unable to complete login.',
        );
    }
};

// ==========================================
// FORGOT PIN
// POST /api/auth/forgot-pin
// ==========================================

const forgotPin = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return errorResponse(
                res,
                400,
                'Phone number is required.',
            );
        }

        const normalizedPhone =
            normalizeUgandaPhone(phoneNumber);

        if (!normalizedPhone) {
            return errorResponse(
                res,
                400,
                'Please provide a valid Uganda mobile number.',
            );
        }

        const user = await User.findOne({
            phoneNumber: normalizedPhone,
        }).select('+resetPinOtp +resetPinOtpLastSentAt');

        if (!user) {
            return errorResponse(
                res,
                404,
                'Account not found.',
            );
        }

        const now = new Date();

        console.log('DEBUG resetPinOtpLastSentAt:', user.resetPinOtpLastSentAt);
        console.log('DEBUG now:', now);

        console.log(
            'DEBUG elapsed:',
            user.resetPinOtpLastSentAt
                ? now - user.resetPinOtpLastSentAt
                : null,
        );

        if (
            user.resetPinOtpLastSentAt &&
            now - user.resetPinOtpLastSentAt < 60 * 1000
        ) {
            console.log('DEBUG: OTP cooldown BLOCKED request');

            return errorResponse(
                res,
                429,
                'Please wait 60 seconds before requesting another OTP.',
            );
        }

        const otp = crypto
            .randomInt(100000, 1000000)
            .toString();

        user.resetPinOtp =
            await bcrypt.hash(otp, 10);

        user.resetPinOtpExpiresAt =
            new Date(
                Date.now() + 5 * 60 * 1000,
            );

        user.resetPinVerified = false;
        user.resetPinOtpAttempts = 0;
        user.resetPinLockedUntil = null;
        user.resetPinOtpLastSentAt = now;

        await user.save();

        console.log(
            `Reset PIN OTP for ${normalizedPhone}: ${otp}`,
        );

        return successResponse(
            res,
            200,
            'OTP sent successfully.',
        );
    } catch (error) {
        console.error(
            'Forgot PIN error:',
            error,
        );

        return errorResponse(
            res,
            500,
            'Unable to process request.',
        );
    }
};

// ==========================================
// VERIFY FORGOT PIN OTP
// POST /api/auth/verify-forgot-pin-otp
// ==========================================

const verifyForgotPinOtp = async (
    req,
    res,
) => {
    try {
        const { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return errorResponse(
                res,
                400,
                'Phone number and OTP are required.',
            );
        }

        if (!/^\d{6}$/.test(String(otp))) {
            return errorResponse(
                res,
                400,
                'OTP must contain exactly 6 digits.',
            );
        }

        const normalizedPhone =
            normalizeUgandaPhone(phoneNumber);

        if (!normalizedPhone) {
            return errorResponse(
                res,
                400,
                'Please provide a valid Uganda mobile number.',
            );
        }

        const user = await User.findOne({
            phoneNumber: normalizedPhone,
        }).select('+resetPinOtp');

        if (!user) {
            return errorResponse(
                res,
                404,
                'Account not found.',
            );
        }

        // Check if OTP verification is temporarily locked
        if (
            user.resetPinLockedUntil &&
            user.resetPinLockedUntil > new Date()
        ) {
            return errorResponse(
                res,
                429,
                'Too many invalid OTP attempts. Please try again later.',
            );
        }

        if (
            !user.resetPinOtp ||
            !user.resetPinOtpExpiresAt ||
            user.resetPinOtpExpiresAt < new Date()
        ) {
            return errorResponse(
                res,
                400,
                'OTP has expired.',
            );
        }

        const validOtp = await bcrypt.compare(
            otp,
            user.resetPinOtp,
        );

        if (!validOtp) {
            user.resetPinOtpAttempts += 1;

            if (user.resetPinOtpAttempts >= 5) {
                user.resetPinLockedUntil = new Date(
                    Date.now() + 15 * 60 * 1000,
                );
            }

            await user.save();

            return errorResponse(
                res,
                400,
                'Invalid OTP.',
            );
        }

        // Successful verification
        user.resetPinVerified = true;
        user.resetPinOtpAttempts = 0;
        user.resetPinLockedUntil = null;

        await user.save();

        return successResponse(
            res,
            200,
            'OTP verified successfully.',
        );
    } catch (error) {
        console.error(
            'OTP verification error:',
            error,
        );

        return errorResponse(
            res,
            500,
            'Unable to verify OTP.',
        );
    }
};

// ==========================================
// RESET PIN
// POST /api/auth/reset-pin
// ==========================================

const resetPin = async (req, res) => {
    try {
        const {
            phoneNumber,
            newPin,
        } = req.body;

        if (!phoneNumber || !newPin) {
            return errorResponse(
                res,
                400,
                'Phone number and new PIN are required.',
            );
        }

        const normalizedPhone =
            normalizeUgandaPhone(phoneNumber);

        if (!normalizedPhone) {
            return errorResponse(
                res,
                400,
                'Please provide a valid Uganda mobile number.',
            );
        }

        const user = await User.findOne({
            phoneNumber: normalizedPhone,
        }).select('+pin');

        if (!user) {
            return errorResponse(
                res,
                404,
                'Account not found.',
            );
        }

        if (!user.resetPinVerified) {
            return errorResponse(
                res,
                400,
                'OTP verification required.',
            );
        }

        if (
            !/^\d{4}$/.test(
                String(newPin),
            )
        ) {
            return errorResponse(
                res,
                400,
                'PIN must contain exactly 4 digits.',
            );
        }

        user.pin = await bcrypt.hash(
            String(newPin),
            10,
        );

        user.resetPinOtp = undefined;
        user.resetPinOtpExpiresAt = undefined;
        user.resetPinVerified = false;
        user.resetPinOtpAttempts = 0;
        user.resetPinLockedUntil = null;

        await user.save();

        console.log(
            `Auth: PIN reset successfully for ${normalizedPhone}`,
        );

        return successResponse(
            res,
            200,
            'PIN reset successfully.',
        );
    } catch (error) {
        console.error(
            'Reset PIN error:',
            error,
        );

        return errorResponse(
            res,
            500,
            'Unable to reset PIN.',
        );
    }
};

module.exports = {
    register,
    login,
    forgotPin,
    verifyForgotPinOtp,
    resetPin,
};
