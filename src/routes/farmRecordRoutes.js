const express = require('express');

const authenticate = require('../middleware/authMiddleware');

const {
  syncRecords,
} = require('../controllers/farmRecordController');

const router = express.Router();

router.post(
  '/sync',
  authenticate,
  syncRecords,
);

module.exports = router;
