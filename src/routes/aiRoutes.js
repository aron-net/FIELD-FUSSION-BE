const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const rateLimitAi = require("../middleware/aiRateLimit");
const {
  chat,
  diagnose,
  getAdvice,
  getHistory,
  getSoil,
  ask,
} = require("../controllers/aiController");

const router = express.Router();
router.use(authenticate);
router.post("/ask", rateLimitAi("ask"), ask);
router.get("/history", getHistory);
router.get("/soil", rateLimitAi("soil"), getSoil);
router.post("/advice", rateLimitAi("advice"), getAdvice);
router.post("/chat", rateLimitAi("chat"), chat);
router.post("/diagnose", rateLimitAi("diagnose"), diagnose);

module.exports = router;
