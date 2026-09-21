const mongoose = require('mongoose');

const connectDatabase = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured.');
  }

  try {
    await mongoose.connect(mongoUri);

    console.log('========================================');
    console.log('        EZYFARM DATABASE');
    console.log('========================================');
    console.log('Status: Connected');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log('========================================');
  } catch (error) {
    console.error(
      'MongoDB connection failed:',
      error.message,
    );

    throw error;
  }
};

module.exports = connectDatabase;
