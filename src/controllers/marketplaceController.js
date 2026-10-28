const mongoose = require('mongoose');
const crypto = require('node:crypto');
const User = require('../models/User');
const Harvest = require('../models/Harvest');
const MarketplaceProduct = require('../models/MarketplaceProduct');
const MarketplaceOrder = require('../models/MarketplaceOrder');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const DELIVERY_FEES_UGX = {
  'Boda Express': 12000,
  'Truck Freight': 25000,
  'Cooperative Depot Pickup': 5000,
};
const CATEGORIES = ['Produce', 'Input & Seeds', 'Fertilizers', 'Tools & Equipment'];
const isValidId = value => mongoose.Types.ObjectId.isValid(value);
const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0;
const isNonNegativeInteger = value => Number.isSafeInteger(value) && value >= 0;

const listProducts = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (typeof req.query.category === 'string') {
      if (!CATEGORIES.includes(req.query.category)) {
        return errorResponse(res, 400, 'Invalid marketplace category.');
      }
      filter.category = req.query.category;
    }
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const escaped = req.query.search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: new RegExp(escaped, 'i') },
        { subCategory: new RegExp(escaped, 'i') },
        { sellerDistrict: new RegExp(escaped, 'i') },
      ];
    }
    const products = await MarketplaceProduct.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);
    return successResponse(res, 200, 'Marketplace products retrieved.', products);
  } catch (error) {
    console.error('List marketplace products error:', error);
    return errorResponse(res, 500, 'Unable to retrieve marketplace products.');
  }
};

const createProduct = async (req, res) => {
  const {
    title: suppliedTitle,
    category: suppliedCategory,
    subCategory,
    priceUGX,
    unit: suppliedUnit,
    minOrderQuantity = 1,
    availableStock: suppliedStock,
    imageUrl,
    description,
    deliveryOptions = [],
    harvestId,
  } = req.body || {};
  try {
    let harvest = null;
    let cropType = '';
    if (harvestId !== undefined) {
      if (!isValidId(harvestId)) return errorResponse(res, 400, 'Invalid harvest id.');
      harvest = await Harvest.findOne({ _id: harvestId, userId: req.userId }).populate(
        'cropId',
        'cropType',
      );
      if (!harvest) return errorResponse(res, 404, 'Harvest not found.');
      if (suppliedCategory !== undefined && suppliedCategory !== 'Produce') {
        return errorResponse(res, 400, 'Harvest-linked listings must use the Produce category.');
      }
      cropType = harvest.cropId?.cropType || '';
    }

    const category = harvest ? 'Produce' : suppliedCategory;
    const title =
      typeof suppliedTitle === 'string' && suppliedTitle.trim()
        ? suppliedTitle.trim()
        : harvest && cropType
          ? `${cropType} harvest`
          : '';
    const unit = suppliedUnit || harvest?.unit;
    const availableStock =
      suppliedStock === undefined && harvest
        ? Math.floor(harvest.quantity)
        : suppliedStock;
    if (
      !title ||
      !CATEGORIES.includes(category) ||
      !isPositiveInteger(priceUGX) ||
      typeof unit !== 'string' ||
      !unit.trim() ||
      !isPositiveInteger(minOrderQuantity) ||
      !isNonNegativeInteger(availableStock) ||
      (harvest && availableStock > harvest.quantity) ||
      !Array.isArray(deliveryOptions) ||
      deliveryOptions.some(option => typeof option !== 'string' || option.length > 50)
    ) {
      return errorResponse(
        res,
        400,
        harvest
          ? 'Provide a valid asking price, order quantity, stock, and delivery options for the harvest listing.'
          : 'Provide a title, valid category, price, unit, stock, and delivery options.',
      );
    }
    if (availableStock > 0 && minOrderQuantity > availableStock) {
      return errorResponse(res, 400, 'Minimum order quantity cannot exceed available stock.');
    }

    const seller = await User.findById(req.userId).select('firstName lastName metadata');
    if (!seller) return errorResponse(res, 404, 'Seller account not found.');

    const product = await MarketplaceProduct.create({
      sellerId: req.userId,
      sellerName: `${seller.firstName} ${seller.lastName}`.trim(),
      sellerDistrict:
        typeof seller.metadata?.district === 'string' ? seller.metadata.district : '',
      title,
      category,
      subCategory: subCategory || cropType,
      priceUGX,
      unit: unit.trim(),
      minOrderQuantity,
      availableStock,
      imageUrl,
      description,
      deliveryOptions,
      harvestId: harvest?._id || null,
      farmId: harvest?.farmId || null,
    });
    return successResponse(res, 201, 'Marketplace listing created.', product);
  } catch (error) {
    if (error.code === 11000 && harvestId !== undefined) {
      return errorResponse(res, 409, 'This harvest already has a marketplace listing.');
    }
    console.error('Create marketplace listing error:', error);
    return errorResponse(res, 500, 'Unable to create marketplace listing.');
  }
};

const updateProduct = async (req, res) => {
  if (!isValidId(req.params.id)) return errorResponse(res, 400, 'Invalid product id.');
  const allowed = [
    'title',
    'category',
    'subCategory',
    'priceUGX',
    'unit',
    'minOrderQuantity',
    'availableStock',
    'imageUrl',
    'description',
    'deliveryOptions',
  ];
  const updates = Object.fromEntries(
    Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)),
  );
  if (!Object.keys(updates).length) {
    return errorResponse(res, 400, 'No supported listing fields provided.');
  }
  if (
    (updates.title !== undefined && (typeof updates.title !== 'string' || !updates.title.trim())) ||
    (updates.category !== undefined && !CATEGORIES.includes(updates.category)) ||
    (updates.priceUGX !== undefined && !isPositiveInteger(updates.priceUGX)) ||
    (updates.minOrderQuantity !== undefined && !isPositiveInteger(updates.minOrderQuantity)) ||
    (updates.availableStock !== undefined && !isNonNegativeInteger(updates.availableStock)) ||
    (updates.deliveryOptions !== undefined &&
      (!Array.isArray(updates.deliveryOptions) ||
        updates.deliveryOptions.some(option => typeof option !== 'string')))
  ) {
    return errorResponse(res, 400, 'One or more listing fields are invalid.');
  }
  try {
    const product = await MarketplaceProduct.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.userId, isActive: true },
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!product) return errorResponse(res, 404, 'Listing not found.');
    return successResponse(res, 200, 'Marketplace listing updated.', product);
  } catch (error) {
    console.error('Update marketplace listing error:', error);
    return errorResponse(res, 500, 'Unable to update marketplace listing.');
  }
};

const deleteProduct = async (req, res) => {
  if (!isValidId(req.params.id)) return errorResponse(res, 400, 'Invalid product id.');
  try {
    const product = await MarketplaceProduct.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.userId, isActive: true },
      { $set: { isActive: false } },
      { new: true },
    );
    if (!product) return errorResponse(res, 404, 'Listing not found.');
    return successResponse(res, 200, 'Marketplace listing removed.');
  } catch (error) {
    console.error('Delete marketplace listing error:', error);
    return errorResponse(res, 500, 'Unable to remove marketplace listing.');
  }
};

const placeOrder = async (req, res) => {
  const {
    items,
    deliveryMethod,
    deliveryAddress,
    contactPhone,
  } = req.body || {};
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 50 ||
    items.some(item => !item || !isValidId(item.productId) || !isPositiveInteger(item.quantity))
  ) {
    return errorResponse(res, 400, 'Order must contain 1 to 50 valid product and quantity items.');
  }
  if (!Object.hasOwn(DELIVERY_FEES_UGX, deliveryMethod)) {
    return errorResponse(res, 400, 'Choose a supported delivery method.');
  }
  if (
    typeof deliveryAddress !== 'string' ||
    !deliveryAddress.trim() ||
    deliveryAddress.length > 500 ||
    typeof contactPhone !== 'string' ||
    !contactPhone.trim() ||
    contactPhone.length > 30
  ) {
    return errorResponse(res, 400, 'A delivery address and recipient phone number are required.');
  }

  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  const reservations = [];
  try {
    const orderItems = [];
    let subtotalUGX = 0;
    for (const [productId, quantity] of quantities) {
      if (!Number.isSafeInteger(quantity)) {
        throw Object.assign(new Error('Requested quantity is too large.'), { statusCode: 400 });
      }
      const product = await MarketplaceProduct.findOneAndUpdate(
        {
          _id: productId,
          isActive: true,
          availableStock: { $gte: quantity },
          minOrderQuantity: { $lte: quantity },
        },
        { $inc: { availableStock: -quantity } },
        { new: true },
      );
      if (!product) {
        throw Object.assign(
          new Error('A product is unavailable or does not have enough stock for this order.'),
          { statusCode: 409 },
        );
      }
      if (String(product.sellerId) === String(req.userId)) {
        throw Object.assign(new Error('You cannot place an order for your own listing.'), {
          statusCode: 400,
        });
      }
      reservations.push({ productId, quantity });
      const itemSubtotal = product.priceUGX * quantity;
      if (!Number.isSafeInteger(itemSubtotal) || !Number.isSafeInteger(subtotalUGX + itemSubtotal)) {
        throw Object.assign(new Error('Order total is too large.'), { statusCode: 400 });
      }
      subtotalUGX += itemSubtotal;
      orderItems.push({
        productId: product._id,
        title: product.title,
        unit: product.unit,
        quantity,
        priceUGX: product.priceUGX,
        sellerId: product.sellerId,
      });
    }

    const deliveryFeeUGX = DELIVERY_FEES_UGX[deliveryMethod];
    if (!Number.isSafeInteger(subtotalUGX + deliveryFeeUGX)) {
      throw Object.assign(new Error('Order total is too large.'), { statusCode: 400 });
    }
    const order = await MarketplaceOrder.create({
      buyerId: req.userId,
      orderNumber: `EF-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      items: orderItems,
      subtotalUGX,
      deliveryMethod,
      deliveryFeeUGX,
      totalAmountUGX: subtotalUGX + deliveryFeeUGX,
      deliveryAddress: deliveryAddress.trim(),
      contactPhone: contactPhone.trim(),
      status: 'Pending Confirmation',
      trackingUpdates: [
        {
          status: 'Order Placed',
          timestamp: new Date(),
          location: '',
        },
      ],
    });
    return successResponse(res, 201, 'Order placed successfully.', order);
  } catch (error) {
    for (const reservation of reservations) {
      try {
        await MarketplaceProduct.updateOne(
          { _id: reservation.productId },
          { $inc: { availableStock: reservation.quantity } },
        );
      } catch (releaseError) {
        console.error('Failed to release product stock after order error:', releaseError);
      }
    }
    if (error.statusCode) return errorResponse(res, error.statusCode, error.message);
    console.error('Place marketplace order error:', error);
    return errorResponse(res, 500, 'Unable to place marketplace order.');
  }
};

const listOrders = async (req, res) => {
  try {
    const orders = await MarketplaceOrder.find({ buyerId: req.userId })
      .sort({ createdAt: -1 })
      .limit(100);
    return successResponse(res, 200, 'Orders retrieved successfully.', orders);
  } catch (error) {
    console.error('List marketplace orders error:', error);
    return errorResponse(res, 500, 'Unable to retrieve orders.');
  }
};

const getOrder = async (req, res) => {
  if (!isValidId(req.params.id)) return errorResponse(res, 400, 'Invalid order id.');
  try {
    const order = await MarketplaceOrder.findOne({
      _id: req.params.id,
      buyerId: req.userId,
    });
    if (!order) return errorResponse(res, 404, 'Order not found.');
    return successResponse(res, 200, 'Order retrieved successfully.', order);
  } catch (error) {
    console.error('Get marketplace order error:', error);
    return errorResponse(res, 500, 'Unable to retrieve order.');
  }
};

module.exports = {
  createProduct,
  deleteProduct,
  getOrder,
  listOrders,
  listProducts,
  placeOrder,
  updateProduct,
};
