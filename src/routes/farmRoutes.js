const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');

const {
  createFarm,
  getFarms,
  getFarm,
  updateFarm,
  deleteFarm,
} = require('../controllers/farmController');

// Protect all farm endpoints
router.use(authenticate);

// Create a farm
router.post('/', createFarm);

// Get all farms belonging to logged-in farmer
router.get('/', getFarms);

// Get one farm
router.get('/:id', getFarm);

// Update a farm
router.put('/:id', updateFarm);

// Delete a farm
router.delete('/:id', deleteFarm);

module.exports = router;
