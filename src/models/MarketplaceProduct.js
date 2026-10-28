const mongoose = require('mongoose');

const MarketplaceProductSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sellerName: { type: String, required: true, trim: true, maxlength: 120 },
    sellerDistrict: { type: String, trim: true, maxlength: 100, default: '' },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    category: {
      type: String,
      enum: ['Produce', 'Input & Seeds', 'Fertilizers', 'Tools & Equipment'],
      required: true,
    },
    subCategory: { type: String, trim: true, maxlength: 100, default: '' },
    priceUGX: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, trim: true, maxlength: 50 },
    minOrderQuantity: { type: Number, min: 1, default: 1 },
    availableStock: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, trim: true, maxlength: 1000, default: '' },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    deliveryOptions: { type: [String], default: [] },
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      default: null,
    },
    harvestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Harvest',
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

MarketplaceProductSchema.index({ isActive: 1, category: 1, createdAt: -1 });
MarketplaceProductSchema.index({ sellerId: 1, createdAt: -1 });
MarketplaceProductSchema.index(
  { harvestId: 1 },
  { unique: true, partialFilterExpression: { harvestId: { $type: 'objectId' } } },
);

module.exports = mongoose.model('MarketplaceProduct', MarketplaceProductSchema);
