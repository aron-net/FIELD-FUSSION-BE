const express = require('express');
const authenticate = require('../middleware/authMiddleware');
const {
  listTransportOrders,
  updateTransportOrder,
} = require('../controllers/transportController');

const router = express.Router();
router.use(authenticate);
router.get('/orders', listTransportOrders);
router.patch('/orders/:id', updateTransportOrder);

module.exports = router;
