const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createActivity,
  createCrop,
  createHarvest,
} = require('../src/controllers/productionController');

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

test('crop creation rejects invalid farm IDs and dates before database access', async () => {
  const response = createResponse();
  await createCrop(
    {
      userId: 'farmer-id',
      body: {
        farmId: 'not-an-object-id',
        cropType: 'Maize',
        plantedDate: 'not-a-date',
        areaAcres: -1,
      },
    },
    response,
  );
  assert.equal(response.statusCode, 400);
});

test('farm activity creation rejects invalid labor amounts and statuses', async () => {
  const response = createResponse();
  await createActivity(
    {
      userId: 'farmer-id',
      body: {
        farmId: '507f1f77bcf86cd799439011',
        type: 'Weeding',
        title: 'Field work',
        date: '2026-10-28',
        laborCount: -2,
        status: 'Unapproved',
      },
    },
    response,
  );
  assert.equal(response.statusCode, 400);
});

test('harvest creation rejects incomplete or unsafe pricing data', async () => {
  const response = createResponse();
  await createHarvest(
    {
      userId: 'farmer-id',
      body: {
        farmId: '507f1f77bcf86cd799439011',
        cropId: '507f1f77bcf86cd799439012',
        harvestDate: '2026-10-28',
        quantity: 100,
        unit: 'kg',
        totalWeightKg: 100,
        estimatedPricePerUnitUGX: Number.MAX_SAFE_INTEGER,
      },
    },
    response,
  );
  assert.equal(response.statusCode, 400);
});
