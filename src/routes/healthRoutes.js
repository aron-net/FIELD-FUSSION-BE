const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', (req, res) => {
  const isDatabaseConnected = mongoose.connection.readyState === 1;

  return res.status(isDatabaseConnected ? 200 : 503).json({
    success: isDatabaseConnected,
    message: isDatabaseConnected
      ? 'EzyFarm backend is ready.'
      : 'EzyFarm backend database is unavailable.',
    data: {
      service: 'ezyfarm-backend',
      status: isDatabaseConnected ? 'healthy' : 'unavailable',
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = router;
