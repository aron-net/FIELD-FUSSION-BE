const mongoose = require('mongoose');
const turf = require('@turf/turf');
const Farm = require('../models/Farm');

const {
  successResponse,
  errorResponse,
} = require('../utils/apiResponse');

/**
 * Validate and calculate farm area from GeoJSON Polygon.
 *
 * Turf returns area in square meters.
 */
const calculateFarmArea = (boundary) => {
  if (!boundary) {
    throw new Error('Farm boundary is required.');
  }

  if (boundary.type !== 'Polygon') {
    throw new Error('Farm boundary must be a Polygon.');
  }

  if (
    !Array.isArray(boundary.coordinates) ||
    boundary.coordinates.length === 0
  ) {
    throw new Error('Farm boundary coordinates are required.');
  }

  const outerRing = boundary.coordinates[0];

  if (
    !Array.isArray(outerRing) ||
    outerRing.length < 4
  ) {
    throw new Error(
      'Farm boundary must contain at least 4 points.'
    );
  }

  // GeoJSON polygons must have the first and last
  // coordinate exactly the same.
  const firstPoint = outerRing[0];
  const lastPoint = outerRing[outerRing.length - 1];

  if (
    !Array.isArray(firstPoint) ||
    !Array.isArray(lastPoint) ||
    firstPoint.length !== 2 ||
    lastPoint.length !== 2 ||
    firstPoint[0] !== lastPoint[0] ||
    firstPoint[1] !== lastPoint[1]
  ) {
    throw new Error(
      'Farm boundary polygon must be closed.'
    );
  }

  // Validate every coordinate.
  for (const ring of boundary.coordinates) {
    if (!Array.isArray(ring)) {
      throw new Error('Invalid polygon coordinates.');
    }

    for (const point of ring) {
      if (
        !Array.isArray(point) ||
        point.length !== 2
      ) {
        throw new Error(
          'Each polygon point must contain longitude and latitude.'
        );
      }

      const [longitude, latitude] = point;

      if (
        typeof longitude !== 'number' ||
        typeof latitude !== 'number' ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude)
      ) {
        throw new Error(
          'Polygon coordinates must contain valid numbers.'
        );
      }

      if (
        longitude < -180 ||
        longitude > 180 ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new Error(
          'Polygon coordinates are outside valid GPS ranges.'
        );
      }
    }
  }

  const polygon = turf.polygon(boundary.coordinates);

  const squareMeters = turf.area(polygon);

  if (
    !Number.isFinite(squareMeters) ||
    squareMeters <= 0
  ) {
    throw new Error(
      'Farm boundary must have an area greater than zero.'
    );
  }

  const hectares = squareMeters / 10000;

  const acres = squareMeters * 0.000247105;

  return {

    value: Number(acres.toFixed(2)),

    unit: 'acres',

    acres: Number(acres.toFixed(2)),

    hectares: Number(hectares.toFixed(2)),

    squareMeters: Number(squareMeters.toFixed(2)),

  };
};

/**
 * Validate farm center.
 */
const validateCenter = (center) => {
  if (!center) {
    throw new Error('Farm center is required.');
  }

  const { latitude, longitude } = center;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error(
      'Farm center must contain valid latitude and longitude.'
    );
  }

  if (
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(
      'Farm center latitude is invalid.'
    );
  }

  if (
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      'Farm center longitude is invalid.'
    );
  }
};

/**
 * Create Farm
 *
 * POST /api/farms
 */
const createFarm = async (req, res) => {
  try {
    const {
      name,
      description,
      center,
      boundary,
      address,
      image,
    } = req.body;

    // -----------------------------
    // Validate farm name
    // -----------------------------
    if (
      typeof name !== 'string' ||
      !name.trim()
    ) {
      return errorResponse(
        res,
        400,
        'Farm name is required.'
      );
    }

    // -----------------------------
    // Validate center
    // -----------------------------
    try {
      validateCenter(center);
    } catch (error) {
      return errorResponse(
        res,
        400,
        error.message
      );
    }

    // -----------------------------
    // Calculate area from polygon
    // -----------------------------
    let area;

    try {
      area = calculateFarmArea(boundary);
    } catch (error) {
      return errorResponse(
        res,
        400,
        error.message
      );
    }

    // -----------------------------
    // Create farm
    // -----------------------------
    const farm = await Farm.create({
      userId: req.userId,

      name: name.trim(),

      description:
        typeof description === 'string'
          ? description.trim()
          : '',

      center,

      boundary,

      // IMPORTANT:
      // Area comes from the backend,
      // NOT from the mobile app.
      area,

      address:
        typeof address === 'string'
          ? address.trim()
          : '',

      image,
    });

    return successResponse(
      res,
      201,
      'Farm created successfully.',
      farm
    );
  } catch (error) {
    console.error(
      'Create farm error:',
      error.message,
    );

    console.error(
      error.stack,
    );

    return errorResponse(
      res,
      500,
      'Unable to create farm.'
    );
  }
};

/**
 * Get all farms
 *
 * GET /api/farms
 */
const getFarms = async (req, res) => {
  try {
    const farms = await Farm.find({
      userId: req.userId,
      isActive: true,
    }).sort({
      createdAt: -1,
    });

    return successResponse(
      res,
      200,
      'Farms retrieved successfully.',
      farms
    );
  } catch (error) {
    console.error(
      'Get farms error:',
      error
    );

    return errorResponse(
      res,
      500,
      'Unable to retrieve farms.'
    );
  }
};

/**
 * Get single farm
 *
 * GET /api/farms/:id
 */
const getFarm = async (req, res) => {
  try {
    // Validate MongoDB ObjectId
    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return errorResponse(
        res,
        400,
        'Invalid farm id.'
      );
    }

    const farm = await Farm.findOne({
      _id: req.params.id,
      userId: req.userId,
      isActive: true,
    });

    if (!farm) {
      return errorResponse(
        res,
        404,
        'Farm not found.'
      );
    }

    return successResponse(
      res,
      200,
      'Farm retrieved successfully.',
      farm
    );
  } catch (error) {
    console.error(
      'Get farm error:',
      error
    );

    return errorResponse(
      res,
      500,
      'Unable to retrieve farm.'
    );
  }
};

/**
 * Update Farm
 *
 * PUT /api/farms/:id
 *
 * If the boundary changes,
 * area is automatically recalculated.
 */
const updateFarm = async (req, res) => {
  try {
    // -----------------------------
    // Validate MongoDB ObjectId
    // -----------------------------
    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return errorResponse(
        res,
        400,
        'Invalid farm id.'
      );
    }

    // -----------------------------
    // Prevent empty update
    // -----------------------------
    if (
      !req.body ||
      Object.keys(req.body).length === 0
    ) {
      return errorResponse(
        res,
        400,
        'No update data provided.'
      );
    }

    // -----------------------------
    // Find farm first
    // -----------------------------
    const farm = await Farm.findOne({
      _id: req.params.id,
      userId: req.userId,
      isActive: true,
    });

    if (!farm) {
      return errorResponse(
        res,
        404,
        'Farm not found.'
      );
    }

    const {
      name,
      description,
      center,
      boundary,
      address,
      image,
    } = req.body;

    // -----------------------------
    // Validate name if supplied
    // -----------------------------
    if (
      name !== undefined
    ) {
      if (
        typeof name !== 'string' ||
        !name.trim()
      ) {
        return errorResponse(
          res,
          400,
          'Farm name cannot be empty.'
        );
      }

      farm.name = name.trim();
    }

    // -----------------------------
    // Validate center if supplied
    // -----------------------------
    if (
      center !== undefined
    ) {
      try {
        validateCenter(center);
      } catch (error) {
        return errorResponse(
          res,
          400,
          error.message
        );
      }

      farm.center = center;
    }

    // -----------------------------
    // Update boundary + recalculate area
    // -----------------------------
    if (
      boundary !== undefined
    ) {
      let area;

      try {
        area = calculateFarmArea(
          boundary
        );
      } catch (error) {
        return errorResponse(
          res,
          400,
          error.message
        );
      }

      farm.boundary = boundary;

      // IMPORTANT:
      // Recalculate area whenever
      // the polygon changes.
      farm.area = area;
    }

    // -----------------------------
    // Other optional fields
    // -----------------------------
    if (
      description !== undefined
    ) {
      farm.description =
        typeof description === 'string'
          ? description.trim()
          : '';
    }

    if (
      address !== undefined
    ) {
      farm.address =
        typeof address === 'string'
          ? address.trim()
          : '';
    }

    if (
      image !== undefined
    ) {
      farm.image = image;
    }

    await farm.save();

    return successResponse(
      res,
      200,
      'Farm updated successfully.',
      farm
    );
  } catch (error) {
    console.error(
      'Update farm error:',
      error
    );

    return errorResponse(
      res,
      500,
      'Unable to update farm.'
    );
  }
};

/**
 * Soft delete farm
 *
 * DELETE /api/farms/:id
 */
const deleteFarm = async (req, res) => {
  try {
    // Validate MongoDB ObjectId
    if (
      !mongoose.Types.ObjectId.isValid(
        req.params.id
      )
    ) {
      return errorResponse(
        res,
        400,
        'Invalid farm id.'
      );
    }

    const farm = await Farm.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.userId,
      },
      {
        isActive: false,
      },
      {
        new: true,
      }
    );

    if (!farm) {
      return errorResponse(
        res,
        404,
        'Farm not found.'
      );
    }

    return successResponse(
      res,
      200,
      'Farm deleted successfully.'
    );
  } catch (error) {
    console.error(
      'Delete farm error:',
      error
    );

    return errorResponse(
      res,
      500,
      'Unable to delete farm.'
    );
  }
};

module.exports = {
  createFarm,
  getFarms,
  getFarm,
  updateFarm,
  deleteFarm,
};

