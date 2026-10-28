const mongoose = require('mongoose');
const User = require('../models/User');
const MarketplaceOrder = require('../models/MarketplaceOrder');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const NEXT_ORDER_STATUS = {
  'Pending Confirmation': ['Confirmed'],
  Confirmed: ['Processing & Packaging'],
  'Processing & Packaging': ['Dispatched / In Transit'],
  'Dispatched / In Transit': ['Delivered'],
};
const isValidId = value => mongoose.Types.ObjectId.isValid(value);

const requireAdmin = async (req, res) => {
  const user = await User.findById(req.userId).select('role');
  if (!user || user.role !== 'ADMIN') {
    errorResponse(res, 403, 'Administrator access is required for transport operations.');
    return false;
  }
  return true;
};

const listTransportOrders = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const filter = {};
    if (typeof req.query.status === 'string') filter.status = req.query.status;
    const orders = await MarketplaceOrder.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);
    return successResponse(res, 200, 'Transport orders retrieved.', orders);
  } catch (error) {
    console.error('List transport orders error:', error);
    return errorResponse(res, 500, 'Unable to retrieve transport orders.');
  }
};

const updateTransportOrder = async (req, res) => {
  if (!isValidId(req.params.id)) return errorResponse(res, 400, 'Invalid order id.');
  const {
    status,
    location,
    transporterName,
    transporterPhone,
    estimatedDeliveryDate,
  } = req.body || {};
  if (
    (status !== undefined && typeof status !== 'string') ||
    (location !== undefined && (typeof location !== 'string' || location.length > 200)) ||
    (transporterName !== undefined &&
      (typeof transporterName !== 'string' || transporterName.length > 120)) ||
    (transporterPhone !== undefined &&
      (typeof transporterPhone !== 'string' || transporterPhone.length > 30)) ||
    (estimatedDeliveryDate !== undefined &&
      !Number.isFinite(Date.parse(estimatedDeliveryDate)))
  ) {
    return errorResponse(res, 400, 'One or more transport update fields are invalid.');
  }
  if (
    status === undefined &&
    location === undefined &&
    transporterName === undefined &&
    transporterPhone === undefined &&
    estimatedDeliveryDate === undefined
  ) {
    return errorResponse(res, 400, 'Provide a status, tracking location, transporter, or delivery estimate.');
  }

  try {
    if (!(await requireAdmin(req, res))) return;
    const order = await MarketplaceOrder.findById(req.params.id);
    if (!order) return errorResponse(res, 404, 'Order not found.');

    if (
      status !== undefined &&
      !(NEXT_ORDER_STATUS[order.status] || []).includes(status)
    ) {
      return errorResponse(
        res,
        409,
        `Order cannot move from ${order.status} to ${status}.`,
      );
    }

    if (status !== undefined) order.status = status;
    if (transporterName !== undefined) order.transporterName = transporterName.trim();
    if (transporterPhone !== undefined) order.transporterPhone = transporterPhone.trim();
    if (estimatedDeliveryDate !== undefined) {
      order.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
    }
    if (status !== undefined || location !== undefined) {
      order.trackingUpdates.push({
        status: status || order.status,
        timestamp: new Date(),
        location: typeof location === 'string' ? location.trim() : '',
      });
    }

    await order.save();
    return successResponse(res, 200, 'Transport order updated.', order);
  } catch (error) {
    console.error('Update transport order error:', error);
    return errorResponse(res, 500, 'Unable to update transport order.');
  }
};

module.exports = { listTransportOrders, updateTransportOrder };
