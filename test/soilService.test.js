const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifySoilTexture,
  getSoilProfile,
} = require("../src/services/soilService");

const soilLayer = (name, value) => ({
  name,
  depths: [{ label: "0-5cm", values: { mean: value } }],
});

test("classifies broad soil textures from sand, silt, and clay fractions", () => {
  assert.equal(classifySoilTexture({ sand: 85, silt: 10, clay: 5 }), "Sand");
  assert.equal(
    classifySoilTexture({ sand: 38.3, silt: 24.1, clay: 37.6 }),
    "Clay loam",
  );
  assert.equal(classifySoilTexture({ sand: 40, silt: 40, clay: 20 }), "Loam");
});

test("normalizes SoilGrids values and labels the estimate", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  let requestedUrl;
  global.fetch = async (url) => {
    requestedUrl = new URL(url);
    return {
      ok: true,
      json: async () => ({
        properties: {
          layers: [
            soilLayer("clay", 376),
            soilLayer("phh2o", 61),
            soilLayer("sand", 383),
            soilLayer("silt", 241),
          ],
        },
      }),
    };
  };

  const profile = await getSoilProfile(2.2511, 32.9011);
  assert.equal(profile.texture, "Clay loam");
  assert.equal(profile.clayPercent, 37.6);
  assert.equal(profile.pH, 6.1);
  assert.equal(profile.cached, false);
  assert.match(profile.caution, /not a field test/);
  assert.equal(requestedUrl.searchParams.get("depth"), "0-5cm");
  assert.equal(requestedUrl.searchParams.getAll("property").length, 4);
});

test("uses the location cache and does not fetch a second time", async (t) => {
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
        properties: {
          layers: [
            soilLayer("clay", 200),
            soilLayer("phh2o", 60),
            soilLayer("sand", 400),
            soilLayer("silt", 400),
          ],
        },
      }),
    };
  };

  const first = await getSoilProfile(-0.1112, 31.1122);
  const second = await getSoilProfile(-0.1113, 31.1123);
  assert.equal(calls, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
});

test("surfaces soil provider errors instead of returning invented soil data", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async () => ({ ok: false, status: 503 });

  await assert.rejects(
    getSoilProfile(3.3211, 34.2211),
    /SoilGrids returned HTTP 503/,
  );
});
