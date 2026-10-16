const DEFAULT_PORT = 5000;
const MINIMUM_JWT_SECRET_LENGTH = 32;

const validateEnvironment = (environment = process.env) => {
  const errors = [];
  const port = Number(environment.PORT || DEFAULT_PORT);
  const mongoUri = environment.MONGO_URI;
  const jwtSecret = environment.JWT_SECRET;
  const nodeEnvironment = environment.NODE_ENV || 'development';

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535.');
  }

  if (
    typeof mongoUri !== 'string' ||
    !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)
  ) {
    errors.push('MONGO_URI must be a valid MongoDB connection URI.');
  }

  if (
    typeof jwtSecret !== 'string' ||
    jwtSecret.length < MINIMUM_JWT_SECRET_LENGTH
  ) {
    errors.push(
      `JWT_SECRET must contain at least ${MINIMUM_JWT_SECRET_LENGTH} characters.`,
    );
  }

  if (!['development', 'test', 'production'].includes(nodeEnvironment)) {
    errors.push(
      'NODE_ENV must be development, test, or production.',
    );
  }

  const corsOrigins = (environment.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  for (const origin of corsOrigins) {
    try {
      if (new URL(origin).origin !== origin) {
        errors.push(`CORS_ORIGINS entry is not an origin: ${origin}`);
      }
    } catch {
      errors.push(`CORS_ORIGINS entry is not a valid origin: ${origin}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }

  return {
    port,
    nodeEnvironment,
    corsOrigins,
  };
};

module.exports = {
  validateEnvironment,
};
