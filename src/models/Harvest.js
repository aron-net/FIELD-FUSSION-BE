const mongoose = require('mongoose');

const HarvestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      required: true,
    },
    cropId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Crop',
      required: true,
    },
    harvestDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true, maxlength: 40 },
    totalWeightKg: { type: Number, required: true, min: 0 },
    grade: { type: String, trim: true, maxlength: 80, default: 'Commercial' },
    storageLocation: { type: String, trim: true, maxlength: 200, default: '' },
    estimatedPricePerUnitUGX: { type: Number, min: 0, default: 0 },
    totalEstimatedValueUGX: { type: Number, min: 0, default: 0 },
    buyerName: { type: String, trim: true, maxlength: 150, default: '' },
    soldStatus: {
      type: String,
      enum: ['Stored', 'Partially Sold', 'Fully Sold'],
      default: 'Stored',
    },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true },
);

HarvestSchema.index({ userId: 1, farmId: 1, harvestDate: -1 });

module.exports = mongoose.model('Harvest', HarvestSchema);
