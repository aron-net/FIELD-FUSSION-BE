const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

process.env.NODE_ENV = "production";
process.env.CORS_ORIGINS = "https://client.example.com";
process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";

const app = require("../src/app");
const { validateEnvironment } = require("../src/config/environment");

let server;
let baseUrl;

after(async () => {
  if (server?.listening) {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
});

const startServer = async () => {
  if (server?.listening) {
    return;
  }

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
};

test("environment validation rejects missing production secrets", () => {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: "production",
        PORT: "5000",
        MONGO_URI: "mongodb://localhost:27017/ezyfarm",
        JWT_SECRET: "short",
      }),
    /JWT_SECRET must contain at least 32 characters/,
  );
});

test("health endpoint reports unavailable when database is disconnected", async () => {
  await startServer();

  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { connection: "close" },
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.data.status, "unavailable");
});

test("farm collection routes are registered and require authentication", async () => {
  await startServer();

  for (const [method, path] of [
    ["GET", "/api/farms"],
    ["POST", "/api/farms"],
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        connection: "close",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: "{}" } : {}),
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.message, "Authentication required.");
  }
});

test("AI assistant routes are registered and require authentication", async () => {
  await startServer();

  for (const [method, path] of [
    ["GET", "/api/ai/soil?latitude=2.25&longitude=32.9"],
    ["POST", "/api/ai/advice"],
    ["POST", "/api/ai/chat"],
    ["POST", "/api/ai/diagnose"],
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        connection: "close",
        ...(method === "GET" ? {} : { "content-type": "application/json" }),
      },
      ...(method === "GET" ? {} : { body: "{}" }),
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.message, "Authentication required.");
  }
});

test("malformed JSON receives a client error response", async () => {
  await startServer();

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      connection: "close",
      "content-type": "application/json",
    },
    body: "{",
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, "Request body contains invalid JSON.");
});

test("production CORS allows configured origins only", async () => {
  await startServer();

  const allowedResponse = await fetch(`${baseUrl}/api/health`, {
    headers: {
      connection: "close",
      origin: "https://client.example.com",
    },
  });
  const blockedResponse = await fetch(`${baseUrl}/api/health`, {
    headers: {
      connection: "close",
      origin: "https://unexpected.example.com",
    },
  });

  assert.equal(
    allowedResponse.headers.get("access-control-allow-origin"),
    "https://client.example.com",
  );
  assert.equal(
    blockedResponse.headers.get("access-control-allow-origin"),
    null,
  );
});

test("production PIN recovery is unavailable without an SMS provider", async () => {
  await startServer();

  const response = await fetch(`${baseUrl}/api/auth/forgot-pin`, {
    method: "POST",
    headers: {
      connection: "close",
      "content-type": "application/json",
    },
    body: JSON.stringify({ phoneNumber: "0700000000" }),
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.message, "PIN recovery is temporarily unavailable.");
});
