// src/server.js
require('dotenv').config();
require('express-async-errors'); // capture async errors in routes

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const multer = require('multer');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errormiddleware');

const authRoutes = require('./routes/authroutes');
const userRoutes = require('./routes/userroutes');
const ticketRoutes = require('./routes/ticketroutes');

const app = express();

// Security & middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: [
          "'self'", 
          "https://backends-1-kzw8.onrender.com"  // 
        ],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

app.use(cors({
  origin: [
    "https://enchanting-mooncake-7ebc83.netlify.app",
    "http://localhost:5173" 
  ],
  credentials: true
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Multer setup for file uploads
const upload = multer({ dest: path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads') });

// Serve uploads (dev only)
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve static files and handle SPA routing
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// 404 + error handler
app.use(notFound);
app.use(errorHandler);

// Start server after DB connection
const PORT = process.env.PORT || 5000;
const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  } catch (err) {
    logger.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();
