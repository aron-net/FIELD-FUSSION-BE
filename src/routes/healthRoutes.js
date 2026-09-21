const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'EzyFarm Cloud Core operational.',
    data: {
      service: 'ezyfarm-backend',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = router;
