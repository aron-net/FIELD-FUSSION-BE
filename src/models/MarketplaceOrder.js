const mongoose = require('mongoose');

const TrackingUpdateSchema = new mongoose.Schema(
  {
    status: { type: String, required: true, maxlength: 100 },
    timestamp: { type: Date, required: true, default: Date.now },
    location: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: false },
);

const MarketplaceOrderSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderNumber: { type: String, required: true, unique: true },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MarketplaceProduct',
          required: true,
        },
        title: { type: String, required: true },
        unit: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        priceUGX: { type: Number, required: true, min: 1 },
        sellerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      },
    ],
    subtotalUGX: { type: Number, required: true, min: 0 },
    totalAmountUGX: { type: Number, required: true, min: 0 },
    deliveryMethod: {
      type: String,
      enum: ['Boda Express', 'Truck Freight', 'Cooperative Depot Pickup'],
      required: true,
    },
    deliveryFeeUGX: { type: Number, required: true, min: 0 },
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 500 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 30 },
    status: {
      type: String,
      enum: [
        'Pending Confirmation',
        'Confirmed',
        'Processing & Packaging',
        'Dispatched / In Transit',
        'Delivered',
        'Cancelled',
      ],
      default: 'Pending Confirmation',
    },
    estimatedDeliveryDate: { type: Date },
    transporterName: { type: String, trim: true, maxlength: 120, default: '' },
    transporterPhone: { type: String, trim: true, maxlength: 30, default: '' },
    trackingUpdates: { type: [TrackingUpdateSchema], default: [] },
  },
  { timestamps: true },
);

MarketplaceOrderSchema.index({ buyerId: 1, createdAt: -1 });
MarketplaceOrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('MarketplaceOrder', MarketplaceOrderSchema);
