const SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const soilCache = new Map();

const classifySoilTexture = ({ sand, silt, clay }) => {
  if (sand >= 85 && clay < 10) return "Sand";
  if (sand >= 70 && clay < 15) return "Loamy sand";
  if (clay >= 40) {
    if (sand >= 45) return "Sandy clay";
    if (silt >= 40) return "Silty clay";
    return "Clay";
  }
  if (clay >= 27) {
    if (sand >= 45) return "Sandy clay loam";
    if (silt >= 40) return "Silty clay loam";
    return "Clay loam";
  }
  if (silt >= 80 && clay < 12) return "Silt";
  if (silt >= 50 && clay < 27) return "Silt loam";
  if (silt >= 28 && silt < 50 && clay >= 7 && sand <= 52) return "Loam";
  if (clay >= 20 && sand >= 45) return "Sandy clay loam";
  if (sand >= 52 && clay < 20) return "Sandy loam";
  return "Loam";
};

const getLayerValue = (layers, name) => {
  const value = layers
    .find((layer) => layer.name === name)
    ?.depths?.find((depth) => depth.label === "0-5cm")?.values?.mean;

  return Number.isFinite(value) ? value : null;
};

const getSoilProfile = async (latitude, longitude) => {
  const cacheKey = `${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
  const cached = soilCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.profile, cached: true };
  }

  const url = new URL(SOILGRIDS_URL);
  url.searchParams.set("lat", latitude);
  url.searchParams.set("lon", longitude);
  for (const property of ["clay", "sand", "silt", "phh2o"]) {
    url.searchParams.append("property", property);
  }
  url.searchParams.set("depth", "0-5cm");
  url.searchParams.set("value", "mean");

  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) {
    throw new Error(`SoilGrids returned HTTP ${response.status}.`);
  }

  const body = await response.json();
  const layers = body?.properties?.layers;
  if (!Array.isArray(layers)) {
    throw new Error("SoilGrids returned an invalid soil profile.");
  }

  const raw = {
    sand: getLayerValue(layers, "sand"),
    silt: getLayerValue(layers, "silt"),
    clay: getLayerValue(layers, "clay"),
    phh2o: getLayerValue(layers, "phh2o"),
  };
  if (Object.values(raw).some((value) => value === null)) {
    throw new Error("SoilGrids did not return all required soil properties.");
  }

  const profile = {
    texture: classifySoilTexture({
      sand: raw.sand / 10,
      silt: raw.silt / 10,
      clay: raw.clay / 10,
    }),
    sandPercent: Number((raw.sand / 10).toFixed(1)),
    siltPercent: Number((raw.silt / 10).toFixed(1)),
    clayPercent: Number((raw.clay / 10).toFixed(1)),
    pH: Number((raw.phh2o / 10).toFixed(1)),
    depth: "0-5 cm",
    source: "ISRIC SoilGrids",
    cached: false,
    caution:
      "This is a regional soil-map estimate for the top 5 cm, not a field test. Soil can vary across a farm; confirm with a local soil test before applying lime or fertilizer.",
  };

  soilCache.set(cacheKey, { profile, expiresAt: Date.now() + CACHE_TTL_MS });
  if (soilCache.size > 5000) {
    for (const [key, entry] of soilCache) {
      if (entry.expiresAt <= Date.now()) soilCache.delete(key);
    }
  }
  return profile;
};

module.exports = { classifySoilTexture, getSoilProfile };
