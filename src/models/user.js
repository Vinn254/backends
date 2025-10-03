// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    specialization: { type: String, trim: true, default: '' }, // for technicians/contractors
    deviceType: { type: String, trim: true, default: '' }, // for customers
    // New customer fields
    firstName: { type: String, trim: true, default: '' },
    otherNames: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    customerSegment: { type: String, trim: true, default: '' }, // POP
    serviceType: { type: String, trim: true, default: '' },
    routerMacAddress: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' }, // Customer location
    billingPlan: { type: String, trim: true, default: '' }, // Billing plan for customers
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['customer', 'csr', 'technician', 'admin', 'contractor'],
      default: 'customer'
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare provided password with stored hash
UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Hide password when returning user as JSON
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
