const {
  successResponse,
  errorResponse,
} = require('../utils/apiResponse');

const {
  getWeatherForLocation,
} = require('../services/weatherService');

const getWeather = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
    } = req.query;

    if (
      latitude === undefined ||
      longitude === undefined
    ) {
      return errorResponse(
        res,
        400,
        'Latitude and longitude are required.',
      );
    }

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      return errorResponse(
        res,
        400,
        'Latitude and longitude must be valid numbers.',
      );
    }

    if (lat < -90 || lat > 90) {
      return errorResponse(
        res,
        400,
        'Latitude must be between -90 and 90.',
      );
    }

    if (lon < -180 || lon > 180) {
      return errorResponse(
        res,
        400,
        'Longitude must be between -180 and 180.',
      );
    }

    const weather =
      await getWeatherForLocation(
        lat,
        lon,
      );

    const weatherData =
      weather.data;

    const responseData = {
      source: weather.source,
      cached: weather.cached,

      location: {
        latitude:
          weatherData.location.latitude,

        longitude:
          weatherData.location.longitude,
      },

      timezone:
        weatherData.timezone,

      timezoneAbbreviation:
        weatherData.timezoneAbbreviation,

      elevation:
        weatherData.elevation,

      current: {
        time:
          weatherData.current?.time,

        temperature:
          weatherData.current?.temperature2m,

        feelsLike:
          weatherData.current?.apparentTemperature,

        humidity:
          weatherData.current?.relativeHumidity2m,

        precipitation:
          weatherData.current?.precipitation,

        rain:
          weatherData.current?.rain,

        showers:
          weatherData.current?.showers,

        weatherCode:
          weatherData.current?.weatherCode,

        cloudCover:
          weatherData.current?.cloudCover,

        windSpeed:
          weatherData.current?.windSpeed10m,

        windDirection:
          weatherData.current?.windDirection10m,

        windGusts:
          weatherData.current?.windGusts10m,

        et0:
          weatherData.current
            ?.et0FaoEvapotranspiration,
      },

      hourly:
        weatherData.hourly || [],

      daily:
        weatherData.daily || [],
    };

    return successResponse(
      res,
      200,
      'Weather retrieved successfully.',
      responseData,
    );
  } catch (error) {
    console.error(
      'Weather controller error:',
      error,
    );

    return errorResponse(
      res,
      500,
      'Unable to retrieve weather.',
    );
  }
};

module.exports = {
  getWeather,
};