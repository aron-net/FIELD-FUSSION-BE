# EzyFarm AI assistant

The assistant uses the Gemini API through the backend. The mobile app never
receives the Gemini API key. Create a key in Google AI Studio and configure it
as the backend secret `GEMINI_API_KEY`; optionally set `GEMINI_MODEL` (defaults
to `gemini-2.5-flash`). Free-tier quotas, regions, and availability are
controlled by Google and can change. The backend returns a retryable error when
the provider quota is reached.

If a Gemini request fails, check the Render service logs for `Gemini request
failed`. The log includes the HTTP status and a bounded provider error message;
the configured API key is redacted. The app also shows a specific hint when
Gemini rejects the key or model. Never share the API key when reporting errors.

Copy the variables from `.env.example` for local development. In production,
add `GEMINI_API_KEY` and (optionally) `GEMINI_MODEL` to the backend host's secret
environment and redeploy. Do not commit `.env` or put the Gemini key in a
React Native app/build variable.

All endpoints below require the existing `Authorization: Bearer <JWT>` header
and use the normal `{success, message, data}` response envelope:

| Method | Endpoint                                  | Purpose                                                                                        |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET`  | `/api/ai/soil?latitude=...&longitude=...` | SoilGrids topsoil estimate, cached up to 30 days                                               |
| `POST` | `/api/ai/advice`                          | Daily plan using supplied farm, soil, and weather context; cached per user/context for one day |
| `POST` | `/api/ai/chat`                            | Text chat with up to eight prior turns and farm context                                        |
| `POST` | `/api/ai/diagnose`                        | Crop/animal photo assessment with optional symptom note                                        |

Image requests accept JPEG, PNG, and WebP, with a base64 image no larger than
700 KB so the request remains within the backend's JSON body limit. AI calls
are bounded per account in each backend process to help conserve free-tier
quota. These in-memory limits/cache are per process; Google also enforces its
own provider quotas.

Soil texture and pH are regional map estimates for the top 5 cm, not farm
laboratory results. AI responses are decision-support only, not veterinary
diagnoses or prescriptions. Severe animal symptoms should be checked promptly
by a veterinarian.

The backend does not persist chat messages or uploaded images. Images are
forwarded to the configured Gemini API for analysis; review Google's current
data-use terms before enabling AI with real farmer data.
