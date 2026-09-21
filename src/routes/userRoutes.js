const express = require('express');

const authenticate = require('../middleware/authMiddleware');

const {
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser,
} = require('../controllers/userController');

const router = express.Router();

router.get(
  '/me',
  authenticate,
  getCurrentUser,
);

router.put(
  '/me',
  authenticate,
  updateCurrentUser,
);

router.delete(
  '/me',
  authenticate,
  deleteCurrentUser,
);

module.exports = router;
