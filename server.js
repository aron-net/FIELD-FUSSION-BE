require('dotenv').config();

const app = require('./src/app');
const connectDatabase = require('./src/config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log('========================================');
      console.log('        EZYFARM CLOUD BACKEND');
      console.log('========================================');
      console.log(
        `Environment: ${process.env.NODE_ENV || 'development'}`,
      );
      console.log(`Port: ${PORT}`);
      console.log(`API: http://localhost:${PORT}`);
      console.log('Status: Running');
      console.log('========================================');
    });
  } catch (error) {
    console.error(
      'Failed to start EzyFarm backend:',
      error,
    );

    process.exit(1);
  }
};

startServer();
