const crypto = require("node:crypto");

const DEFAULT_MODEL = "gemini-flash-latest";
const MAX_OUTPUT_TOKENS = 1600;
const DAILY_ADVICE_TTL_MS = 24 * 60 * 60 * 1000;
const dailyAdviceCache = new Map();

class AiProviderError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "AiProviderError";
    this.statusCode = statusCode;
  }
}

const cleanText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const safeNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const createFarmContext = (context) => {
  const farm =
    context?.farm && typeof context.farm === "object" ? context.farm : {};
  const weather =
    context?.weather && typeof context.weather === "object"
      ? context.weather
      : {};
  const soil =
    context?.soil && typeof context.soil === "object" ? context.soil : {};

  return {
    farm: {
      name: cleanText(farm.name, 100) || undefined,
      address: cleanText(farm.address, 250) || undefined,
      district: cleanText(farm.district, 100) || undefined,
      area: safeNumber(farm.area),
      areaUnit: cleanText(farm.areaUnit, 20) || undefined,
      crops: Array.isArray(farm.crops)
        ? farm.crops
            .filter((crop) => typeof crop === "string")
            .slice(0, 8)
            .map((crop) => cleanText(crop, 50))
        : [],
    },
    weather: {
      temperature: safeNumber(weather.temperature),
      humidity: safeNumber(weather.humidity),
      precipitationProbability: safeNumber(weather.precipitationProbability),
      precipitation: safeNumber(weather.precipitation),
      windSpeed: safeNumber(weather.windSpeed),
      forecast: cleanText(weather.forecast, 250),
    },
    soil: {
      texture: cleanText(soil.texture, 60) || undefined,
      sandPercent: safeNumber(soil.sandPercent),
      siltPercent: safeNumber(soil.siltPercent),
      clayPercent: safeNumber(soil.clayPercent),
      pH: safeNumber(soil.pH),
      depth: cleanText(soil.depth, 20) || undefined,
      source: cleanText(soil.source, 60) || undefined,
    },
  };
};

const requestGemini = async ({ systemInstruction, contents }) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiProviderError(
      "The AI assistant is not configured on the server yet.",
      503,
    );
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new AiProviderError(
        "The AI request timed out. Please try again.",
        504,
      );
    }
    throw new AiProviderError(
      "The AI service is temporarily unavailable. Please try again.",
      503,
    );
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new AiProviderError(
        "The free AI service is busy. Please wait a little and try again.",
        429,
      );
    }
    let providerError;
    try {
      providerError = (await response.json())?.error;
    } catch {
      providerError = undefined;
    }
    const providerMessage =
      typeof providerError?.message === "string"
        ? providerError.message.slice(0, 400).replaceAll(apiKey, "[redacted]")
        : "No provider error detail returned.";
    console.error(
      "Gemini request failed:",
      JSON.stringify({
        httpStatus: response.status,
        providerStatus:
          typeof providerError?.status === "string"
            ? providerError.status
            : undefined,
        providerMessage,
      }),
    );
    const providerDetails =
      `${providerError?.status || ""} ${providerMessage}`.toLowerCase();
    if (/api.?key|credential/.test(providerDetails)) {
      throw new AiProviderError(
        "Gemini rejected the configured API key. Check that GEMINI_API_KEY is a valid Google AI Studio key and redeploy the backend.",
        502,
      );
    }
    if (
      /model.{0,40}(not found|not supported|not available|invalid)|(?:not found|not supported|not available|invalid).{0,40}model/.test(
        providerDetails,
      )
    ) {
      throw new AiProviderError(
        "Gemini rejected the configured model. Unset GEMINI_MODEL or set it to a model enabled for this API key, then redeploy.",
        502,
      );
    }
    throw new AiProviderError(
      response.status >= 500
        ? "The AI service is temporarily unavailable. Please try again."
        : "Gemini rejected the request. Check the backend service logs for its error details.",
      502,
    );
  }

  const result = await response.json();
  const candidate = result?.candidates?.[0];
  const answer = candidate?.content?.parts
    ?.map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  if (!answer) {
    throw new AiProviderError("The AI service returned an empty response.");
  }
  const text =
    candidate.finishReason === "MAX_TOKENS"
      ? `${answer}\n\n_This answer may be incomplete. Ask me to continue._`
      : answer;
  return { text, model };
};

const getDailyAdvice = async (context, userId) => {
  const safeContext = createFarmContext(context);
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(safeContext))
    .digest("hex");
  const cacheKey = `${userId}:${new Date().toISOString().slice(0, 10)}:${fingerprint}`;
  const cached = dailyAdviceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, cached: true };
  }

  const { text, model } = await requestGemini({
    systemInstruction:
      "You are EzyFarm, a cautious agricultural decision-support assistant for smallholder farmers in Uganda. Give practical, prioritized actions for today based only on the supplied farm, soil-map estimate, and weather data. If crop/animal details or important measurements are missing, say so and ask what is needed. Do not invent soil, crop, or weather facts. Never prescribe pesticide doses or veterinary medicines. Clearly state that soil-map values are estimates and advise a local soil test before lime/fertilizer decisions. Keep the advice to 3 short actions and mention when the farmer should consult an agricultural extension worker or veterinarian.",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Give today's farm advice using only this current information:\n${JSON.stringify(safeContext)}`,
          },
        ],
      },
    ],
  });
  const result = { advice: text, model, cached: false };
  dailyAdviceCache.set(cacheKey, {
    result,
    expiresAt: Date.now() + DAILY_ADVICE_TTL_MS,
  });
  if (dailyAdviceCache.size > 5000) {
    for (const [key, entry] of dailyAdviceCache) {
      if (entry.expiresAt <= Date.now()) dailyAdviceCache.delete(key);
    }
  }
  return result;
};

const chatWithAssistant = async ({ message, history, context }) => {
  const safeContext = createFarmContext(context);
  const safeHistory = Array.isArray(history)
    ? history
        .slice(-8)
        .filter(
          (turn) =>
            (turn?.role === "user" || turn?.role === "model") &&
            typeof turn?.text === "string",
        )
        .map((turn) => ({
          role: turn.role,
          parts: [{ text: cleanText(turn.text, 1200) }],
        }))
    : [];
  const { text, model } = await requestGemini({
    systemInstruction:
      "You are the EzyFarm agricultural assistant. Help with farming in clear, practical language. You may discuss crop pests and animal health, but photos and chat are not a definitive diagnosis. Ask clarifying questions when needed. For animals with severe symptoms, recommend an in-person veterinarian promptly. Never prescribe veterinary drugs or pesticide doses. Do not invent farm, soil, or weather facts; use the supplied context only when relevant. When discussing soil, label map data as an estimate, not a field test. Keep answers concise and actionable, ordinarily under 250 words. Use short headings and simple bullet points when they improve readability.",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Farm context (may be incomplete): ${JSON.stringify(safeContext)}`,
          },
        ],
      },
      ...safeHistory,
      { role: "user", parts: [{ text: cleanText(message, 1500) }] },
    ],
  });
  return { reply: text, model };
};

const diagnoseImage = async ({
  imageBase64,
  mimeType,
  subject,
  note,
  context,
}) => {
  const safeContext = createFarmContext(context);
  const subjectName = subject === "animal" ? "animal health" : "crop health";
  const { text, model } = await requestGemini({
    systemInstruction:
      "You are an agricultural decision-support assistant for farmers in Uganda. Inspect the supplied image carefully. State what is and is not visible, give possible causes only (not a definitive diagnosis), ask for missing symptoms or history, and suggest low-risk next steps. Do not prescribe veterinary medicines, pesticide products, or application doses. For severe animal symptoms, recommend prompt in-person veterinary care. Mention image limitations and advise local expert confirmation before treatment. Keep the response concise, ordinarily under 250 words, and use simple headings or bullets where useful.",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Help assess this ${subjectName} concern. Farmer's note: ${cleanText(note, 700) || "No additional notes provided."}\nFarm context: ${JSON.stringify(safeContext)}`,
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
  });
  return { assessment: text, model };
};

module.exports = {
  AiProviderError,
  chatWithAssistant,
  createFarmContext,
  diagnoseImage,
  getDailyAdvice,
};
