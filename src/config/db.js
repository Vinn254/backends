// src/config/db.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async (mongoUri) => {
  try {
    await mongoose.connect(mongoUri, {
      // Mongoose 7+ uses good defaults; options kept explicit for clarity
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error:', err.message);
    throw err; // let server handle exit
  }
};

module.exports = connectDB;
