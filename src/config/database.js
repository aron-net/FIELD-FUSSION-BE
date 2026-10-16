const mongoose = require('mongoose');

const connectDatabase = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured.');
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 20,
      minPoolSize: 0,
    });

    console.log('========================================');
    console.log('        EZYFARM DATABASE');
    console.log('========================================');
    console.log('Status: Connected');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log('========================================');

    mongoose.connection.on('disconnected', () => {
      console.error('MongoDB connection was lost.');
    });
  } catch (error) {
    console.error(
      'MongoDB connection failed:',
      error.message,
    );

    throw error;
  }
};

module.exports = connectDatabase;
