const mongoose = require('mongoose');

const weatherHourlySchema = new mongoose.Schema(
    {
        time: {
            type: String,
            required: true,
        },

        temperature2m: Number,
        relativeHumidity2m: Number,
        apparentTemperature: Number,

        precipitationProbability: Number,
        precipitation: Number,
        rain: Number,
        showers: Number,

        weatherCode: Number,

        cloudCover: Number,

        windSpeed10m: Number,
        windDirection10m: Number,
        windGusts10m: Number,

        et0FaoEvapotranspiration: Number,
    },
    {
        _id: false,
    },
);

const weatherDailySchema = new mongoose.Schema(
    {
        date: {
            type: String,
            required: true,
        },

        weatherCode: Number,

        temperature2mMax: Number,
        temperature2mMin: Number,

        apparentTemperatureMax: Number,
        apparentTemperatureMin: Number,

        sunrise: String,
        sunset: String,

        precipitationSum: Number,
        rainSum: Number,
        showersSum: Number,

        precipitationHours: Number,
        precipitationProbabilityMax: Number,

        windSpeed10mMax: Number,
        windGusts10mMax: Number,
        windDirection10mDominant: Number,

        et0FaoEvapotranspiration: Number,
    },
    {
        _id: false,
    },
);

const weatherSnapshotSchema = new mongoose.Schema(
    {
        location: {
            latitude: {
                type: Number,
                required: true,
            },

            longitude: {
                type: Number,
                required: true,
            },

            gridKey: {
                type: String,
                required: true,
                index: true,
            },
        },

        timezone: {
            type: String,
        },

        timezoneAbbreviation: {
            type: String,
        },

        elevation: {
            type: Number,
        },

        provider: {
            name: {
                type: String,
                default: 'open-meteo',
            },

            model: {
                type: String,
            },
        },

        current: {
            time: String,

            temperature2m: Number,
            relativeHumidity2m: Number,
            apparentTemperature: Number,

            precipitation: Number,
            rain: Number,
            showers: Number,

            weatherCode: Number,

            cloudCover: Number,

            windSpeed10m: Number,
            windDirection10m: Number,
            windGusts10m: Number,

            et0FaoEvapotranspiration: Number,
        },

        hourly: {
            type: [weatherHourlySchema],
            default: [],
        },

        daily: {
            type: [weatherDailySchema],
            default: [],
        },

        fetchedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },

        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

weatherSnapshotSchema.index({
    expiresAt: 1,
});

module.exports = mongoose.model(
    'WeatherSnapshot',
    weatherSnapshotSchema,
);
