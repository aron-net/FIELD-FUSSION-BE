require('dotenv').config();

const mongoose = require('mongoose');
const { validateEnvironment } = require('./src/config/environment');

const { port } = validateEnvironment();
const app = require('./src/app');
const connectDatabase = require('./src/config/database');

const startServer = async () => {
  try {
    await connectDatabase();

    const server = app.listen(port, '0.0.0.0', () => {
      console.log(
        `EzyFarm backend listening on port ${port} (${process.env.NODE_ENV || 'development'}).`,
      );
    });

    server.requestTimeout = 30_000;
    server.headersTimeout = 35_000;
    server.keepAliveTimeout = 5_000;

    let isShuttingDown = false;

    const shutdown = signal => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;
      console.log(`Received ${signal}; shutting down gracefully.`);

      const forceShutdown = setTimeout(() => {
        console.error('Graceful shutdown timed out; closing open connections.');
        server.closeAllConnections();
        process.exit(1);
      }, 10_000);

      server.close(async error => {
        clearTimeout(forceShutdown);

        try {
          await mongoose.disconnect();
          process.exitCode = error ? 1 : 0;
        } catch (disconnectError) {
          console.error('Database disconnect failed:', disconnectError);
          process.exitCode = 1;
        }
      });
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error(
      'Failed to start EzyFarm backend:',
      error,
    );

    process.exitCode = 1;
  }
};

startServer();
