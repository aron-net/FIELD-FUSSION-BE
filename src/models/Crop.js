const mongoose = require('mongoose');

const CropSchema = new mongoose.Schema(
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
    cropType: { type: String, required: true, trim: true, maxlength: 100 },
    variety: { type: String, trim: true, maxlength: 100, default: '' },
    plantedDate: { type: Date, required: true },
    expectedHarvestDate: { type: Date },
    areaAcres: { type: Number, required: true, min: 0 },
    stage: { type: String, trim: true, maxlength: 80, default: 'Germination / Planting' },
    stageProgressPercent: { type: Number, min: 0, max: 100, default: 0 },
    healthStatus: {
      type: String,
      enum: ['Excellent', 'Good', 'Attention Needed', 'Critical'],
      default: 'Good',
    },
    healthNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    estimatedYieldKg: { type: Number, min: 0, default: 0 },
    actualHarvestKg: { type: Number, min: 0 },
    fertilizerUsed: { type: String, trim: true, maxlength: 500, default: '' },
    sprayHistory: { type: [String], default: [] },
  },
  { timestamps: true },
);

CropSchema.index({ userId: 1, farmId: 1, createdAt: -1 });

module.exports = mongoose.model('Crop', CropSchema);
