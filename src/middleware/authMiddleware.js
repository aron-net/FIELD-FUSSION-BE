const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication format.',
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session.',
      });
    }

    if (
      typeof decoded.id !== 'string' ||
      !mongoose.Types.ObjectId.isValid(decoded.id)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session.',
      });
    }

    const activeUser = await User.exists({
      _id: decoded.id,
      isActive: true,
    });

    if (!activeUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session.',
      });
    }

    req.userId = decoded.id;
    return next();
  } catch (error) {
    console.error('Authentication check failed:', error);

    return res.status(503).json({
      success: false,
      message: 'Authentication service is temporarily unavailable.',
    });
  }
};

module.exports = authenticate;
