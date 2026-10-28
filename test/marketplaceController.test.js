const assert = require('node:assert/strict');
const { mock, test } = require('node:test');
const User = require('../src/models/User');
const Harvest = require('../src/models/Harvest');
const MarketplaceProduct = require('../src/models/MarketplaceProduct');
const MarketplaceOrder = require('../src/models/MarketplaceOrder');
const {
  createProduct,
  placeOrder,
} = require('../src/controllers/marketplaceController');

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

test('marketplace checkout rejects unsupported delivery methods', async () => {
  const response = createResponse();
  await placeOrder(
    {
      userId: 'farmer-id',
      body: {
        items: [{ productId: '507f1f77bcf86cd799439011', quantity: 2, priceUGX: 1 }],
        deliveryMethod: 'Unknown Carrier',
        deliveryAddress: 'Kampala',
        contactPhone: '+256700000000',
      },
    },
    response,
  );
  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /supported delivery method/);
});

test('marketplace checkout requires valid product quantities and recipient details', async () => {
  const response = createResponse();
  await placeOrder(
    {
      userId: 'farmer-id',
      body: {
        items: [{ productId: 'bad-id', quantity: -1 }],
        deliveryMethod: 'Truck Freight',
        deliveryAddress: '',
        contactPhone: '',
      },
    },
    response,
  );
  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /valid product and quantity/);
});

test('checkout prices items from current listings and reserves their stock', async (t) => {
  const listingId = '507f1f77bcf86cd799439011';
  const sellerId = '507f1f77bcf86cd799439012';
  let stockUpdate;
  const reserve = mock.method(
    MarketplaceProduct,
    'findOneAndUpdate',
    async (filter, update) => {
      stockUpdate = { filter, update };
      return {
        _id: listingId,
        sellerId,
        title: 'Maize',
        unit: 'kg',
        priceUGX: 1500,
      };
    },
  );
  const create = mock.method(MarketplaceOrder, 'create', async order => order);
  t.after(() => {
    reserve.mock.restore();
    create.mock.restore();
  });

  const response = createResponse();
  await placeOrder(
    {
      userId: '507f1f77bcf86cd799439013',
      body: {
        items: [{ productId: listingId, quantity: 3, priceUGX: 1 }],
        deliveryMethod: 'Boda Express',
        deliveryAddress: 'Masaka',
        contactPhone: '+256700000000',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.subtotalUGX, 4500);
  assert.equal(response.body.data.deliveryFeeUGX, 12000);
  assert.equal(response.body.data.totalAmountUGX, 16500);
  assert.equal(response.body.data.items[0].priceUGX, 1500);
  assert.deepEqual(stockUpdate.update, { $inc: { availableStock: -3 } });
  assert.equal(stockUpdate.filter.minOrderQuantity.$lte, 3);
});

test('a harvest can be listed with only its harvest ID and asking price', async (t) => {
  const harvestId = '507f1f77bcf86cd799439011';
  let createdProduct;
  const findHarvest = mock.method(Harvest, 'findOne', () => ({
    async populate() {
      return {
        _id: harvestId,
        farmId: '507f1f77bcf86cd799439014',
        quantity: 65,
        unit: 'Bunches',
        cropId: { cropType: 'Matooke' },
      };
    },
  }));
  const findUser = mock.method(User, 'findById', () => ({
    async select() {
      return { firstName: 'Amina', lastName: 'Farmer', metadata: { district: 'Masaka' } };
    },
  }));
  const create = mock.method(MarketplaceProduct, 'create', async product => {
    createdProduct = product;
    return product;
  });
  t.after(() => {
    findHarvest.mock.restore();
    findUser.mock.restore();
    create.mock.restore();
  });

  const response = createResponse();
  await createProduct(
    {
      userId: '507f1f77bcf86cd799439013',
      body: { harvestId, priceUGX: 24000 },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(createdProduct.title, 'Matooke harvest');
  assert.equal(createdProduct.category, 'Produce');
  assert.equal(createdProduct.unit, 'Bunches');
  assert.equal(createdProduct.availableStock, 65);
  assert.equal(createdProduct.priceUGX, 24000);
  assert.equal(createdProduct.sellerDistrict, 'Masaka');
});
