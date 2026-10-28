const assert = require('node:assert/strict');
const { mock, test } = require('node:test');
const User = require('../src/models/User');
const MarketplaceOrder = require('../src/models/MarketplaceOrder');
const { updateTransportOrder } = require('../src/controllers/transportController');

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('transport updates require an administrator account', async (t) => {
  const select = mock.fn(async () => ({ role: 'FARMER' }));
  const findUser = mock.method(User, 'findById', () => ({ select }));
  t.after(() => findUser.mock.restore());

  const response = createResponse();
  await updateTransportOrder(
    {
      userId: '507f1f77bcf86cd799439011',
      params: { id: '507f1f77bcf86cd799439012' },
      body: { status: 'Confirmed' },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
});

test('transport status updates record tracking and enforce the next status', async (t) => {
  const userSelect = mock.fn(async () => ({ role: 'ADMIN' }));
  const findUser = mock.method(User, 'findById', () => ({ select: userSelect }));
  const order = {
    status: 'Confirmed',
    trackingUpdates: [],
    async save() {},
  };
  const findOrder = mock.method(MarketplaceOrder, 'findById', async () => order);
  t.after(() => {
    findUser.mock.restore();
    findOrder.mock.restore();
  });

  const response = createResponse();
  await updateTransportOrder(
    {
      userId: '507f1f77bcf86cd799439011',
      params: { id: '507f1f77bcf86cd799439012' },
      body: {
        status: 'Processing & Packaging',
        location: 'Kampala warehouse',
        transporterName: 'Dispatch team',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.status, 'Processing & Packaging');
  assert.equal(response.body.data.transporterName, 'Dispatch team');
  assert.equal(response.body.data.trackingUpdates[0].location, 'Kampala warehouse');
});
