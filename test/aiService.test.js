const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AiProviderError,
  chatWithAssistant,
  createFarmContext,
  diagnoseImage,
  getDailyAdvice,
} = require("../src/services/aiService");

const originalApiKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;

test.beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;
});

test.after(() => {
  if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalApiKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
});

test("limits farm context to known, bounded fields", () => {
  const context = createFarmContext({
    farm: {
      name: "North Field",
      crops: ["maize", "beans", "x".repeat(100)],
      secret: "must not be sent",
    },
    soil: { texture: "Clay loam", pH: 6.1, private: "must not be sent" },
  });
  assert.deepEqual(context.farm.crops, ["maize", "beans", "x".repeat(50)]);
  assert.equal(context.farm.secret, undefined);
  assert.equal(context.soil.private, undefined);
  assert.equal(context.soil.pH, 6.1);
});

test("sends chat through Gemini on the server with bounded conversation history", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: "Check the leaves today." }] } },
        ],
      }),
    };
  };

  const result = await chatWithAssistant({
    message: "What should I check?",
    context: { farm: { name: "North Field" } },
    history: Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? "model" : "user",
      text: `turn ${index}`,
    })),
  });
  assert.equal(result.reply, "Check the leaves today.");
  assert.equal(result.model, "gemini-2.5-flash");
  assert.match(request.url, /gemini-2\.5-flash:generateContent$/);
  assert.equal(request.options.headers["x-goog-api-key"], "test-key");
  assert.equal(request.body.contents.length, 10);
  assert.equal(
    request.body.contents.at(-1).parts[0].text,
    "What should I check?",
  );
});

test("sends crop or animal images as inline data for assessment", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: "Possible leaf damage." }] } },
        ],
      }),
    };
  };

  const result = await diagnoseImage({
    imageBase64: "a".repeat(120),
    mimeType: "image/jpeg",
    subject: "crop",
    note: "Yellow patches",
  });
  assert.equal(result.assessment, "Possible leaf damage.");
  assert.equal(
    requestBody.contents[0].parts[1].inline_data.mime_type,
    "image/jpeg",
  );
  assert.equal(
    requestBody.contents[0].parts[1].inline_data.data,
    "a".repeat(120),
  );
  assert.match(
    requestBody.systemInstruction.parts[0].text,
    /not a definitive diagnosis/,
  );
});

test("caches daily advice per farmer and supplied farm context", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: "Check drainage today." }] } },
        ],
      }),
    };
  };
  const context = { farm: { name: "North Field" } };
  const first = await getDailyAdvice(context, "farmer-advice-cache-test");
  const second = await getDailyAdvice(context, "farmer-advice-cache-test");
  assert.equal(calls, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.advice, "Check drainage today.");
});

test("returns a clear configuration error without exposing a provider secret", async () => {
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(
    getDailyAdvice({}),
    (error) =>
      error instanceof AiProviderError &&
      error.statusCode === 503 &&
      /not configured/.test(error.message),
  );
});

test("reports free-tier throttling as a retryable error", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async () => ({ ok: false, status: 429 });

  await assert.rejects(
    chatWithAssistant({ message: "Help", history: [] }),
    (error) => error instanceof AiProviderError && error.statusCode === 429,
  );
});
