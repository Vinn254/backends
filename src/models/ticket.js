// src/models/Ticket.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const UpdateSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String }, // denormalized for easy reads
    message: { type: String, required: true },
    status: { type: String }, // optional status recorded with update
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const AssignmentHistorySchema = new Schema({
  from: { type: Schema.Types.ObjectId, ref: 'User' },
  to: { type: Schema.Types.ObjectId, ref: 'User' },
  by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, default: Date.now }
});

const StatusHistorySchema = new Schema({
  from: { type: String },
  to: { type: String, required: true },
  by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, default: Date.now }
});

const AttachmentSchema = new Schema({
  filename: String,
  path: String,
  contentType: String,
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
});

const TicketSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // who reported
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // customer or CSR
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    status: {
      type: String,
      enum: ['open', 'assigned', 'in_progress', 'waiting_customer', 'on_site', 'resolved', 'closed'],
      default: 'open'
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' }, // technician
    assignmentHistory: [AssignmentHistorySchema],
    statusHistory: [StatusHistorySchema],
    updates: [UpdateSchema],
    attachments: [AttachmentSchema],
    resolutionSummary: { type: String },
    resolutionCategory: { type: String },
    resolvedAt: { type: Date },
    closedAt: { type: Date }
  },
  { timestamps: true }
);

// Useful indexes
TicketSchema.index({ status: 1 });
TicketSchema.index({ priority: 1 });
TicketSchema.index({ assignedTo: 1 });
TicketSchema.index({ customer: 1 });
TicketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Ticket', TicketSchema);
