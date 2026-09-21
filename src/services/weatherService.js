const WeatherSnapshot = require('../models/WeatherSnapshot');

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast';

const CACHE_HOURS = 1;

/**
 * Convert coordinates into a small weather grid.
 *
 * We do not want every tiny GPS difference
 * to create a separate weather record.
 */
const createGridKey = (latitude, longitude) => {
  const gridLatitude = Number(latitude).toFixed(3);
  const gridLongitude = Number(longitude).toFixed(3);

  return `${gridLatitude}:${gridLongitude}`;
};

/**
 * Build the Open-Meteo request.
 */
const buildWeatherUrl = (
  latitude,
  longitude,
) => {
  const url = new URL(OPEN_METEO_URL);

  url.searchParams.set(
    'latitude',
    latitude,
  );

  url.searchParams.set(
    'longitude',
    longitude,
  );

  url.searchParams.set(
    'current',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'rain',
      'showers',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'et0_fao_evapotranspiration',
    ].join(','),
  );

  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation_probability',
      'precipitation',
      'rain',
      'showers',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'et0_fao_evapotranspiration',
    ].join(','),
  );

  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'sunrise',
      'sunset',
      'precipitation_sum',
      'rain_sum',
      'showers_sum',
      'precipitation_hours',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
      'wind_direction_10m_dominant',
      'et0_fao_evapotranspiration',
    ].join(','),
  );

  url.searchParams.set(
    'timezone',
    'auto',
  );

  url.searchParams.set(
    'forecast_days',
    '7',
  );

  return url;
};

/**
 * Convert Open-Meteo response into
 * our EzyFarm weather structure.
 */
const normalizeWeatherData = (
  data,
  gridKey,
) => {
  const current = data.current || {};
  const hourly = data.hourly || {};
  const daily = data.daily || {};

  const hourlyRecords = [];

  const hourlyTimes =
    hourly.time || [];

  for (
    let index = 0;
    index < hourlyTimes.length;
    index += 1
  ) {
    hourlyRecords.push({
      time: hourlyTimes[index],

      temperature2m:
        hourly.temperature_2m?.[index],

      relativeHumidity2m:
        hourly.relative_humidity_2m?.[index],

      apparentTemperature:
        hourly.apparent_temperature?.[index],

      precipitationProbability:
        hourly.precipitation_probability?.[index],

      precipitation:
        hourly.precipitation?.[index],

      rain:
        hourly.rain?.[index],

      showers:
        hourly.showers?.[index],

      weatherCode:
        hourly.weather_code?.[index],

      cloudCover:
        hourly.cloud_cover?.[index],

      windSpeed10m:
        hourly.wind_speed_10m?.[index],

      windDirection10m:
        hourly.wind_direction_10m?.[index],

      windGusts10m:
        hourly.wind_gusts_10m?.[index],

      et0FaoEvapotranspiration:
        hourly.et0_fao_evapotranspiration?.[index],
    });
  }

  const dailyRecords = [];

  const dailyTimes =
    daily.time || [];

  for (
    let index = 0;
    index < dailyTimes.length;
    index += 1
  ) {
    dailyRecords.push({
      date: dailyTimes[index],

      weatherCode:
        daily.weather_code?.[index],

      temperature2mMax:
        daily.temperature_2m_max?.[index],

      temperature2mMin:
        daily.temperature_2m_min?.[index],

      apparentTemperatureMax:
        daily.apparent_temperature_max?.[index],

      apparentTemperatureMin:
        daily.apparent_temperature_min?.[index],

      sunrise:
        daily.sunrise?.[index],

      sunset:
        daily.sunset?.[index],

      precipitationSum:
        daily.precipitation_sum?.[index],

      rainSum:
        daily.rain_sum?.[index],

      showersSum:
        daily.showers_sum?.[index],

      precipitationHours:
        daily.precipitation_hours?.[index],

      precipitationProbabilityMax:
        daily.precipitation_probability_max?.[index],

      windSpeed10mMax:
        daily.wind_speed_10m_max?.[index],

      windGusts10mMax:
        daily.wind_gusts_10m_max?.[index],

      windDirection10mDominant:
        daily.wind_direction_10m_dominant?.[index],

      et0FaoEvapotranspiration:
        daily.et0_fao_evapotranspiration?.[index],
    });
  }

  return {
    location: {
      latitude: data.latitude,
      longitude: data.longitude,
      gridKey,
    },

    timezone: data.timezone,

    timezoneAbbreviation:
      data.timezone_abbreviation,

    elevation: data.elevation,

    provider: {
      name: 'open-meteo',
      model: data.current?.model,
    },

    current: {
      time: current.time,

      temperature2m:
        current.temperature_2m,

      relativeHumidity2m:
        current.relative_humidity_2m,

      apparentTemperature:
        current.apparent_temperature,

      precipitation:
        current.precipitation,

      rain:
        current.rain,

      showers:
        current.showers,

      weatherCode:
        current.weather_code,

      cloudCover:
        current.cloud_cover,

      windSpeed10m:
        current.wind_speed_10m,

      windDirection10m:
        current.wind_direction_10m,

      windGusts10m:
        current.wind_gusts_10m,

      et0FaoEvapotranspiration:
        current.et0_fao_evapotranspiration,
    },

    hourly: hourlyRecords,

    daily: dailyRecords,
  };
};

/**
 * Fetch weather from Open-Meteo.
 */
const fetchFromOpenMeteo = async (
  latitude,
  longitude,
) => {
  const url = buildWeatherUrl(
    latitude,
    longitude,
  );

  console.log(
    `Weather provider request: ${url.toString()}`,
  );

  const response = await fetch(
    url.toString(),
  );

  if (!response.ok) {
    throw new Error(
      `Open-Meteo returned HTTP ${response.status}`,
    );
  }

  return response.json();
};

/**
 * Get weather for a farm location.
 *
 * MongoDB is checked first.
 * Open-Meteo is called only when
 * our cached weather is missing or expired.
 */
const getWeatherForLocation = async (
  latitude,
  longitude,
) => {
  const gridKey = createGridKey(
    latitude,
    longitude,
  );

  const now = new Date();

  const cachedWeather =
    await WeatherSnapshot.findOne({
      'location.gridKey': gridKey,
      expiresAt: {
        $gt: now,
      },
    }).lean();

  if (cachedWeather) {
    console.log(
      `Weather cache HIT: ${gridKey}`,
    );

    return {
      source: 'database',
      cached: true,
      data: cachedWeather,
    };
  }

  console.log(
    `Weather cache MISS: ${gridKey}`,
  );

  const providerData =
    await fetchFromOpenMeteo(
      latitude,
      longitude,
    );

  const normalizedData =
    normalizeWeatherData(
      providerData,
      gridKey,
    );

  const expiresAt = new Date(
    Date.now() +
    CACHE_HOURS * 60 * 60 * 1000,
  );

  const weatherDocument =
    await WeatherSnapshot.findOneAndUpdate(
      {
        'location.gridKey': gridKey,
      },
      {
        $set: {
          ...normalizedData,
          fetchedAt: new Date(),
          expiresAt,
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).lean();

  return {
    source: 'open-meteo',
    cached: false,
    data: weatherDocument,
  };
};

module.exports = {
  getWeatherForLocation,
};
