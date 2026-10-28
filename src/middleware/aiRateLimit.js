const WINDOW_MS = 60 * 60 * 1000;
const LIMITS = {
  advice: 10,
  ask: 10,
  chat: 30,
  diagnose: 5,
  soil: 60,
};
const windows = new Map();

const rateLimitAi = (action) => (req, res, next) => {
  const now = Date.now();
  if (windows.size > 10000) {
    for (const [key, timestamps] of windows) {
      const recent = timestamps.filter(
        (timestamp) => now - timestamp < WINDOW_MS,
      );
      if (recent.length) windows.set(key, recent);
      else windows.delete(key);
    }
  }

  const key = `${req.userId}:${action}`;
  const recent = (windows.get(key) || []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );
  if (recent.length >= LIMITS[action]) {
    return res.status(429).json({
      success: false,
      message:
        "You have reached the assistant limit for now. Please try later.",
    });
  }

  recent.push(now);
  windows.set(key, recent);
  return next();
};

module.exports = rateLimitAi;
