const mongoose = require('mongoose');

const FarmActivitySchema = new mongoose.Schema(
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
      default: null,
    },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    date: { type: Date, required: true },
    laborCount: { type: Number, min: 0, default: 0 },
    laborCostUGX: { type: Number, min: 0, default: 0 },
    inputCostUGX: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    status: {
      type: String,
      enum: ['Completed', 'Scheduled', 'In Progress'],
      default: 'Completed',
    },
  },
  { timestamps: true },
);

FarmActivitySchema.index({ userId: 1, farmId: 1, date: -1 });

module.exports = mongoose.model('FarmActivity', FarmActivitySchema);
