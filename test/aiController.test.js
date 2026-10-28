const assert = require("node:assert/strict");
const { mock, test } = require("node:test");

const AiChatHistory = require("../src/models/AiChatHistory");
const { ask, getHistory } = require("../src/controllers/aiController");

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

test("AI ask rejects a missing prompt without calling the provider", async () => {
  const response = createResponse();

  await ask({ body: { prompt: " " }, userId: "farmer-id" }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /prompt of 1 to 1500 characters/);
});

test("AI ask saves the response under the authenticated farmer", async (t) => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;
  process.env.GEMINI_API_KEY = "test-key";
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [
        { content: { parts: [{ text: "Check soil moisture." }] } },
      ],
    }),
  });
  const create = mock.method(AiChatHistory, "create", async (record) => ({
    ...record,
    _id: "history-id",
  }));
  t.after(() => {
    create.mock.restore();
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  });

  const response = createResponse();
  await ask(
    {
      body: {
        prompt: "What should I check?",
        farmName: "North Field",
        cropType: "Maize",
        user: { id: "untrusted-client-id" },
      },
      userId: "authenticated-farmer-id",
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.reply, "Check soil moisture.");
  assert.equal(response.body.data.userId, "authenticated-farmer-id");
  assert.equal(response.body.data.farmName, "North Field");
  assert.equal(response.body.data.cropType, "Maize");
  assert.equal(create.mock.calls.length, 1);
});

test("AI history is queried only for the authenticated farmer and caps the limit", async (t) => {
  let filter;
  let queryLimit;
  const history = [{ prompt: "When should I plant?" }];
  const find = mock.method(AiChatHistory, "find", (query) => {
    filter = query;
    return {
      sort(sortOrder) {
        assert.deepEqual(sortOrder, { createdAt: -1 });
        return this;
      },
      limit(limit) {
        queryLimit = limit;
        return this;
      },
      async lean() {
        return history;
      },
    };
  });
  t.after(() => find.mock.restore());

  const response = createResponse();
  await getHistory(
    { query: { limit: "1000", userId: "another-farmer-id" }, userId: "farmer-id" },
    response,
  );

  assert.deepEqual(filter, { userId: "farmer-id" });
  assert.equal(queryLimit, 100);
  assert.equal(response.body.history, history);
});
