const mongoose = require('mongoose');

const FarmSchema = new mongoose.Schema(
  {
    // The farmer who owns this farm
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Basic farm information
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    // Geographic center of the farm
    center: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90,
      },

      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180,
      },
    },

    // Actual farm boundary
    // GeoJSON Polygon:
    //
    // [
    //   [longitude, latitude],
    //   [longitude, latitude],
    //   ...
    //   [longitude, latitude]
    // ]
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
        default: 'Polygon',
        required: true,
      },

      coordinates: {
        type: [[[Number]]],
        required: true,
      },
    },

    // Area calculated by the backend from the polygon
    area: {
      // Primary/default area value
      value: {
        type: Number,
        required: true,
        min: 0,
      },

      // Primary/default unit
      unit: {
        type: String,
        enum: [
          'acres',
          'hectares',
          'square_meters',
        ],
        default: 'acres',
      },

      // All supported area units
      acres: {
        type: Number,
        required: true,
        min: 0,
      },

      hectares: {
        type: Number,
        required: true,
        min: 0,
      },

      squareMeters: {
        type: Number,
        required: true,
        min: 0,
      },
    },

    // Human-readable location
    address: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    // Optional farm image
    image: {
      url: {
        type: String,
        trim: true,
        default: '',
      },

      publicId: {
        type: String,
        trim: true,
        default: '',
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Useful for finding all farms belonging to a farmer
FarmSchema.index({
  userId: 1,
});

// GeoJSON geospatial index
FarmSchema.index({
  boundary: '2dsphere',
});

module.exports = mongoose.model('Farm', FarmSchema);
