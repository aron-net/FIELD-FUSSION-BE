const mongoose = require('mongoose');
const Crop = require('../models/Crop');
const FarmActivity = require('../models/FarmActivity');
const Harvest = require('../models/Harvest');
const Farm = require('../models/Farm');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const isValidId = value => mongoose.Types.ObjectId.isValid(value);
const isValidDate = value =>
  (typeof value === 'string' || value instanceof Date) &&
  Number.isFinite(Date.parse(value));
const isNonNegativeNumber = value =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isPositiveNumber = value =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const getFarmForUser = (farmId, userId) =>
  Farm.findOne({ _id: farmId, userId, isActive: true });

const listCrops = async (req, res) => {
  try {
    const filter = { userId: req.userId };
    if (req.query.farmId) {
      if (!isValidId(req.query.farmId)) {
        return errorResponse(res, 400, 'Invalid farm id.');
      }
      filter.farmId = req.query.farmId;
    }

    const crops = await Crop.find(filter)
      .populate('farmId', 'name address area')
      .sort({ createdAt: -1 });
    return successResponse(res, 200, 'Crops retrieved successfully.', crops);
  } catch (error) {
    console.error('List crops error:', error);
    return errorResponse(res, 500, 'Unable to retrieve crops.');
  }
};

const createCrop = async (req, res) => {
  try {
    const {
      farmId,
      cropType,
      variety,
      plantedDate,
      expectedHarvestDate,
      areaAcres,
      stage,
      fertilizerUsed,
    } = req.body || {};

    if (
      !isValidId(farmId) ||
      typeof cropType !== 'string' ||
      !cropType.trim() ||
      !isValidDate(plantedDate) ||
      !isPositiveNumber(areaAcres)
    ) {
      return errorResponse(
        res,
        400,
        'Farm, crop type, planted date, and a positive cultivated area are required.',
      );
    }
    if (expectedHarvestDate && !isValidDate(expectedHarvestDate)) {
      return errorResponse(res, 400, 'Expected harvest date must be valid.');
    }

    const farm = await getFarmForUser(farmId, req.userId);
    if (!farm) return errorResponse(res, 404, 'Farm not found.');

    const crop = await Crop.create({
      userId: req.userId,
      farmId,
      cropType: cropType.trim(),
      variety,
      plantedDate,
      expectedHarvestDate,
      areaAcres,
      stage,
      fertilizerUsed,
    });
    await crop.populate('farmId', 'name address area');
    return successResponse(res, 201, 'Crop batch created successfully.', crop);
  } catch (error) {
    console.error('Create crop error:', error);
    return errorResponse(res, 500, 'Unable to create crop batch.');
  }
};

const getCrop = async (req, res) => {
  if (!isValidId(req.params.id)) return errorResponse(res, 400, 'Invalid crop id.');
  try {
    const crop = await Crop.findOne({ _id: req.params.id, userId: req.userId })
      .populate('farmId', 'name address area');
    if (!crop) return errorResponse(res, 404, 'Crop not found.');
    return successResponse(res, 200, 'Crop retrieved successfully.', crop);
  } catch (error) {
    console.error('Get crop error:', error);
    return errorResponse(res, 500, 'Unable to retrieve crop.');
  }
};

const updateCrop = async (req, res) => {
  const allowed = [
    'cropType',
    'variety',
    'plantedDate',
    'expectedHarvestDate',
    'areaAcres',
    'stage',
    'stageProgressPercent',
    'healthStatus',
    'healthNotes',
    'estimatedYieldKg',
    'actualHarvestKg',
    'fertilizerUsed',
    'sprayHistory',
  ];
  if (!isValidId(req.params.id)) return errorResponse(res, 400, 'Invalid crop id.');
  const updates = Object.fromEntries(
    Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)),
  );
  if (Object.keys(updates).length === 0) {
    return errorResponse(res, 400, 'No supported crop fields provided.');
  }
  if (
    (updates.plantedDate !== undefined && !isValidDate(updates.plantedDate)) ||
    (updates.expectedHarvestDate !== undefined &&
      updates.expectedHarvestDate !== null &&
      !isValidDate(updates.expectedHarvestDate)) ||
    (updates.areaAcres !== undefined && !isPositiveNumber(updates.areaAcres)) ||
    (updates.estimatedYieldKg !== undefined &&
      !isNonNegativeNumber(updates.estimatedYieldKg)) ||
    (updates.actualHarvestKg !== undefined &&
      !isNonNegativeNumber(updates.actualHarvestKg)) ||
    (updates.stageProgressPercent !== undefined &&
      (!isNonNegativeNumber(updates.stageProgressPercent) ||
        updates.stageProgressPercent > 100)) ||
    (updates.cropType !== undefined &&
      (typeof updates.cropType !== 'string' || !updates.cropType.trim())) ||
    (updates.sprayHistory !== undefined &&
      (!Array.isArray(updates.sprayHistory) ||
        updates.sprayHistory.some(item => typeof item !== 'string')))
  ) {
    return errorResponse(res, 400, 'One or more crop fields are invalid.');
  }

  try {
    const crop = await Crop.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: updates },
      { new: true, runValidators: true },
    ).populate('farmId', 'name address area');
    if (!crop) return errorResponse(res, 404, 'Crop not found.');
    return successResponse(res, 200, 'Crop updated successfully.', crop);
  } catch (error) {
    console.error('Update crop error:', error);
    return errorResponse(res, 500, 'Unable to update crop.');
  }
};

const deleteCrop = async (req, res) => {
  if (!isValidId(req.params.id)) return errorResponse(res, 400, 'Invalid crop id.');
  try {
    const crop = await Crop.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!crop) return errorResponse(res, 404, 'Crop not found.');
    return successResponse(res, 200, 'Crop deleted successfully.');
  } catch (error) {
    console.error('Delete crop error:', error);
    return errorResponse(res, 500, 'Unable to delete crop.');
  }
};

const listActivities = async (req, res) => {
  try {
    const filter = { userId: req.userId };
    if (req.query.farmId) {
      if (!isValidId(req.query.farmId)) {
        return errorResponse(res, 400, 'Invalid farm id.');
      }
      filter.farmId = req.query.farmId;
    }
    const activities = await FarmActivity.find(filter)
      .populate('farmId', 'name')
      .populate('cropId', 'cropType')
      .sort({ date: -1, createdAt: -1 });
    return successResponse(res, 200, 'Farm activities retrieved successfully.', activities);
  } catch (error) {
    console.error('List farm activities error:', error);
    return errorResponse(res, 500, 'Unable to retrieve farm activities.');
  }
};

const createActivity = async (req, res) => {
  const {
    farmId,
    cropId,
    type,
    title,
    date,
    laborCount = 0,
    laborCostUGX = 0,
    inputCostUGX = 0,
    notes = '',
    status = 'Completed',
  } = req.body || {};
  if (
    !isValidId(farmId) ||
    typeof type !== 'string' ||
    !type.trim() ||
    typeof title !== 'string' ||
    !title.trim() ||
    !isValidDate(date) ||
    !Number.isSafeInteger(laborCount) ||
    laborCount < 0 ||
    !isNonNegativeNumber(laborCostUGX) ||
    !isNonNegativeNumber(inputCostUGX) ||
    !['Completed', 'Scheduled', 'In Progress'].includes(status)
  ) {
    return errorResponse(res, 400, 'Farm, activity type, title, valid date, and valid costs are required.');
  }
  try {
    const farm = await getFarmForUser(farmId, req.userId);
    if (!farm) return errorResponse(res, 404, 'Farm not found.');
    if (cropId) {
      if (!isValidId(cropId) || !(await Crop.exists({ _id: cropId, userId: req.userId, farmId }))) {
        return errorResponse(res, 404, 'Crop not found on this farm.');
      }
    }
    const activity = await FarmActivity.create({
      userId: req.userId,
      farmId,
      cropId: cropId || null,
      type: type.trim(),
      title: title.trim(),
      date,
      laborCount,
      laborCostUGX,
      inputCostUGX,
      notes,
      status,
    });
    await activity.populate([{ path: 'farmId', select: 'name' }, { path: 'cropId', select: 'cropType' }]);
    return successResponse(res, 201, 'Farm activity recorded successfully.', activity);
  } catch (error) {
    console.error('Create farm activity error:', error);
    return errorResponse(res, 500, 'Unable to record farm activity.');
  }
};

const listHarvests = async (req, res) => {
  try {
    const filter = { userId: req.userId };
    if (req.query.farmId) {
      if (!isValidId(req.query.farmId)) {
        return errorResponse(res, 400, 'Invalid farm id.');
      }
      filter.farmId = req.query.farmId;
    }
    const harvests = await Harvest.find(filter)
      .populate('farmId', 'name')
      .populate('cropId', 'cropType')
      .sort({ harvestDate: -1, createdAt: -1 });
    return successResponse(res, 200, 'Harvests retrieved successfully.', harvests);
  } catch (error) {
    console.error('List harvests error:', error);
    return errorResponse(res, 500, 'Unable to retrieve harvests.');
  }
};

const createHarvest = async (req, res) => {
  const {
    farmId,
    cropId,
    harvestDate,
    quantity,
    unit,
    totalWeightKg,
    grade,
    storageLocation,
    estimatedPricePerUnitUGX = 0,
    buyerName,
    soldStatus,
    notes,
  } = req.body || {};
  if (
    !isValidId(farmId) ||
    !isValidId(cropId) ||
    !isValidDate(harvestDate) ||
    !isPositiveNumber(quantity) ||
    typeof unit !== 'string' ||
    !unit.trim() ||
    !isNonNegativeNumber(totalWeightKg) ||
    !isNonNegativeNumber(estimatedPricePerUnitUGX) ||
    !['Stored', 'Partially Sold', 'Fully Sold'].includes(soldStatus || 'Stored') ||
    !Number.isSafeInteger(quantity * estimatedPricePerUnitUGX)
  ) {
    return errorResponse(res, 400, 'Farm, crop, harvest date, quantity, unit, weight, and valid price are required.');
  }
  try {
    const farm = await getFarmForUser(farmId, req.userId);
    if (!farm) return errorResponse(res, 404, 'Farm not found.');
    const crop = await Crop.findOne({ _id: cropId, userId: req.userId, farmId });
    if (!crop) return errorResponse(res, 404, 'Crop not found on this farm.');

    const harvest = await Harvest.create({
      userId: req.userId,
      farmId,
      cropId,
      harvestDate,
      quantity,
      unit: unit.trim(),
      totalWeightKg,
      grade,
      storageLocation,
      estimatedPricePerUnitUGX,
      totalEstimatedValueUGX: quantity * estimatedPricePerUnitUGX,
      buyerName,
      soldStatus,
      notes,
    });
    await harvest.populate([{ path: 'farmId', select: 'name' }, { path: 'cropId', select: 'cropType' }]);
    return successResponse(res, 201, 'Harvest recorded successfully.', harvest);
  } catch (error) {
    console.error('Create harvest error:', error);
    return errorResponse(res, 500, 'Unable to record harvest.');
  }
};

module.exports = {
  createActivity,
  createCrop,
  createHarvest,
  deleteCrop,
  getCrop,
  listActivities,
  listCrops,
  listHarvests,
  updateCrop,
};
