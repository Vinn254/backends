// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const signToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
};

// Public registration: creates customer accounts only
exports.register = async (req, res, next) => {
  try {
  const { name, phone, email, password } = req.body;
  if (!name || !email || !phone) return res.status(400).json({ message: 'Missing required fields' });

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: 'Email already registered' });

  const user = new User({ name, phone, email, password, role: 'customer' });
  await user.save();

  const token = signToken(user);
  res.status(201).json({ token, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ token, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
};

// Protected: get current user info
exports.me = async (req, res, next) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
};
