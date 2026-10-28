const express = require('express');
const authenticate = require('../middleware/authMiddleware');
const {
  createProduct,
  deleteProduct,
  getOrder,
  listOrders,
  listProducts,
  placeOrder,
  updateProduct,
} = require('../controllers/marketplaceController');

const router = express.Router();
router.use(authenticate);

router.get('/products', listProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.get('/orders', listOrders);
router.post('/orders', placeOrder);
router.get('/orders/:id', getOrder);

module.exports = router;
