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
              unit: unit || 'kg',
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
