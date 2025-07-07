const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.DB_URL || 'mongodb://127.0.0.1:27017/venkan213';
    console.log('Attempting to connect to MongoDB:', mongoURI);

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      family: 4, // Still okay for IPv4
      maxPoolSize: 10,
      minPoolSize: 1
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    process.exit(1);
  }
};

module.exports = connectDB;
