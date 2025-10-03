// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller');
const { authMiddleware } = require('../middleware/authmiddleware');

// Public register (creates customer)
router.post('/register', authController.register);

// Public login
router.post('/login', authController.login);

// Protected: get current user
router.get('/me', authMiddleware, authController.me);

module.exports = router;
