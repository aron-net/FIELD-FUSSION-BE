const {
  AiProviderError,
  chatWithAssistant,
  diagnoseImage,
  getDailyAdvice,
} = require("../services/aiService");
const { getSoilProfile } = require("../services/soilService");
const { errorResponse, successResponse } = require("../utils/apiResponse");
const AiChatHistory = require("../models/AiChatHistory");

const parseCoordinates = (latitude, longitude) => {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    latitude === undefined ||
    longitude === undefined ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }
  return { latitude: lat, longitude: lon };
};

const getSoil = async (req, res) => {
  const coordinates = parseCoordinates(req.query.latitude, req.query.longitude);
  if (!coordinates) {
    return errorResponse(
      res,
      400,
      "Valid latitude and longitude are required.",
    );
  }
  try {
    const profile = await getSoilProfile(
      coordinates.latitude,
      coordinates.longitude,
    );
    return successResponse(
      res,
      200,
      "Estimated soil profile retrieved.",
      profile,
    );
  } catch (error) {
    console.error("Soil profile request failed:", error.message);
    return errorResponse(
      res,
      502,
      "Soil map data is temporarily unavailable. Try again later.",
    );
  }
};

const sendAiResult = async (res, operation) => {
  try {
    const result = await operation();
    return successResponse(res, 200, "AI response generated.", result);
  } catch (error) {
    if (error instanceof AiProviderError) {
      return errorResponse(res, error.statusCode, error.message);
    }
    console.error("AI request failed:", error);
    return errorResponse(res, 502, "Unable to generate an AI response.");
  }
};

const getAdvice = (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return errorResponse(res, 400, "Farm and weather context are required.");
  }
  return sendAiResult(res, () => getDailyAdvice(req.body.context, req.userId));
};

const chat = (req, res) => {
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 1500) {
    return errorResponse(res, 400, "Enter a message of 1 to 1500 characters.");
  }
  return sendAiResult(res, () =>
    chatWithAssistant({
      message,
      history: req.body.history,
      context: req.body.context,
    }),
  );
};

const ask = async (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt || prompt.length > 1500) {
    return errorResponse(res, 400, "Enter a prompt of 1 to 1500 characters.");
  }

  const farmName =
    typeof req.body?.farmName === "string"
      ? req.body.farmName.trim().slice(0, 100)
      : "";
  const cropType =
    typeof req.body?.cropType === "string"
      ? req.body.cropType.trim().slice(0, 50)
      : "";
  const context =
    req.body?.context && typeof req.body.context === "object"
      ? req.body.context
      : { farm: { name: farmName, crops: cropType ? [cropType] : [] } };

  try {
    const result = await chatWithAssistant({
      message: prompt,
      context,
    });
    const historyRecord = await AiChatHistory.create({
      userId: req.userId,
      prompt,
      reply: result.reply,
      farmName,
      cropType,
      category: "Agronomic Consultation",
      modelUsed: result.model,
    });

    return successResponse(
      res,
      200,
      "AI response generated.",
      historyRecord,
    );
  } catch (error) {
    if (error instanceof AiProviderError) {
      return errorResponse(res, error.statusCode, error.message);
    }
    console.error("AI consultation could not be saved:", error);
    return errorResponse(res, 500, "Unable to save the AI consultation.");
  }
};

const getHistory = async (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 50;

  try {
    const history = await AiChatHistory.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      message: "AI consultation history retrieved.",
      count: history.length,
      history,
    });
  } catch (error) {
    console.error("AI consultation history retrieval failed:", error);
    return errorResponse(res, 500, "Unable to retrieve AI consultation history.");
  }
};

const diagnose = (req, res) => {
  const { imageBase64, mimeType, subject, note, context } = req.body || {};
  if (
    typeof imageBase64 !== "string" ||
    imageBase64.length < 100 ||
    imageBase64.length > 700000 ||
    imageBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)
  ) {
    return errorResponse(res, 400, "Choose a smaller, valid image to analyze.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return errorResponse(res, 400, "Upload a JPEG, PNG, or WebP image.");
  }
  if (subject !== "crop" && subject !== "animal") {
    return errorResponse(res, 400, "Choose crop or animal health support.");
  }
  return sendAiResult(res, () =>
    diagnoseImage({ imageBase64, mimeType, subject, note, context }),
  );
};

module.exports = { ask, chat, diagnose, getAdvice, getHistory, getSoil };
