const mongoose = require('mongoose');

const FarmRecordSchema = new mongoose.Schema(
  {
    offlineId: {
      type: String,
      required: true,
      trim: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    cropType: {
      type: String,
      required: true,
      trim: true,
    },

    activity: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      default: 'kg',
      trim: true,
    },

    timestamp: {
      type: Date,
      required: true,
    },

    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Each farmer can have their own offline IDs.
// The same offlineId may exist for different farmers.
FarmRecordSchema.index(
  {
    userId: 1,
    offlineId: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model(
  'FarmRecord',
  FarmRecordSchema,
);
