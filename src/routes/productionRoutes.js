const express = require('express');
const authenticate = require('../middleware/authMiddleware');
const {
  createActivity,
  createCrop,
  createHarvest,
  deleteCrop,
  getCrop,
  listActivities,
  listCrops,
  listHarvests,
  updateCrop,
} = require('../controllers/productionController');

const router = express.Router();
router.use(authenticate);

router.route('/crops').get(listCrops).post(createCrop);
router.route('/crops/:id').get(getCrop).put(updateCrop).delete(deleteCrop);
router.route('/activities').get(listActivities).post(createActivity);
router.route('/harvests').get(listHarvests).post(createHarvest);

module.exports = router;
