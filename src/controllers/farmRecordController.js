const FarmRecord = require('../models/FarmRecord');

const {
  successResponse,
  errorResponse,
} = require('../utils/apiResponse');

const syncRecords = async (req, res) => {
  try {
    const {records} = req.body;

    if (!Array.isArray(records)) {
      return errorResponse(
        res,
        400,
        'Records must be provided as an array.',
      );
    }

    if (records.length === 0) {
      return errorResponse(
        res,
        400,
        'No records were provided.',
      );
    }

    if (records.length > 500) {
      return errorResponse(
        res,
        400,
        'A maximum of 500 records can be synchronized at once.',
      );
    }

    const hasInvalidRecord = records.some(record => (
      !record ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      typeof record.offlineId !== 'string' ||
      !record.offlineId.trim() ||
      record.offlineId.length > 200 ||
      typeof record.cropType !== 'string' ||
      !record.cropType.trim() ||
      record.cropType.length > 100 ||
      typeof record.activity !== 'string' ||
      !record.activity.trim() ||
      record.activity.length > 100 ||
      typeof record.quantity !== 'number' ||
      !Number.isFinite(record.quantity) ||
      record.quantity < 0 ||
      typeof record.timestamp !== 'string' ||
      !Number.isFinite(Date.parse(record.timestamp)) ||
      (
        record.unit !== undefined &&
        (
          typeof record.unit !== 'string' ||
          record.unit.length > 30
        )
      )
    ));

    if (hasInvalidRecord) {
      return errorResponse(
        res,
        400,
        'Each record must have a valid offlineId, cropType, activity, quantity, and timestamp.',
      );
    }

    const operations = records.map(record => {
      const {
        offlineId,
        cropType,
        activity,
        quantity,
        unit,
        timestamp,
      } = record;

      return {
        updateOne: {
          filter: {
            userId: req.userId,
            offlineId,
          },

          update: {
            $set: {
              offlineId,
              userId: req.userId,
              cropType,
              activity,
              quantity,
              unit: typeof unit === 'string' && unit.trim()
                ? unit.trim()
                : 'kg',
              timestamp,
              syncedAt: new Date(),
            },
          },

          upsert: true,
        },
      };
    });

    await FarmRecord.bulkWrite(
      operations,
      {
        ordered: false,
      },
    );

    console.log(
      `Sync: ${records.length} farm records processed.`,
    );

    return successResponse(
      res,
      200,
      'Farm records synchronized successfully.',
      {
        count: records.length,
      },
    );
  } catch (error) {
    console.error(
      'Farm record sync error:',
      error,
    );

    return errorResponse(
      res,
      500,
      'Unable to synchronize farm records.',
    );
  }
};

module.exports = {
  syncRecords,
};
