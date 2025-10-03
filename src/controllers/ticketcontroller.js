// src/controllers/ticketController.js
const Ticket = require('../models/ticket');
const User = require('../models/user');

// Create ticket (customers or CSR can create on behalf)
exports.createTicket = async (req, res, next) => {
  try {
    const { title, description, priority, customerId } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Missing required fields' });

    console.log('DEBUG: req.user in createTicket:', req.user);

    const customer = customerId ? await User.findById(customerId) : req.user;
    if (!customer) return res.status(400).json({ message: 'Customer not found' });

    const ticket = new Ticket({
      customer: customer._id,
      createdBy: req.user._id,
      title,
      description,
      priority: priority || 'low',
      status: 'open'
    });

    ticket.statusHistory.push({ from: null, to: 'open', by: req.user._id });

    await ticket.save();

    console.log('DEBUG: Created ticket:', ticket);

    res.status(201).json({ ticket });
  } catch (err) {
    next(err);
  }
};

// Get tickets with filters, role constraints
exports.getTickets = async (req, res, next) => {
  try {
    // Disable caching for ticket list responses
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    const { status, assignedTo, customerId, priority, page = 1, limit = 20, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (customerId) filter.customer = customerId;
    if (priority) filter.priority = priority;
    if (search) {
      // basic text search on title/description
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    // customers can only see their tickets
    if (req.user.role === 'customer') {
      filter.customer = req.user._id;
      console.log('DEBUG: getTickets filter for customer', { filter, user: req.user });
    }

    const tickets = await Ticket.find(filter)
      .populate('customer', 'name email phone')
      .populate('assignedTo', 'name email phone')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const total = await Ticket.countDocuments(filter);

    res.json({ tickets, total, page: parseInt(page, 10) });
  } catch (err) {
    next(err);
  }
};

// Get a single ticket by id
exports.getTicketById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id)
      .populate('customer', 'name email phone')
      .populate('assignedTo', 'name email phone')
      .populate('updates.author', 'name email');
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (req.user.role === 'customer' && ticket.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

// Update ticket (limited fields)
exports.updateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, priority } = req.body;
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Only CSR/admin or assigned technician may update main fields
    if (!['csr', 'admin'].includes(req.user.role) && !(req.user.role === 'technician' && ticket.assignedTo && ticket.assignedTo.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (title) ticket.title = title;
    if (description) ticket.description = description;
    if (priority) ticket.priority = priority;

    await ticket.save();
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

// Assign ticket to a technician (CSR/Admin)
exports.assignTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { technicianId } = req.body;
    if (!technicianId) return res.status(400).json({ message: 'technicianId required' });

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const tech = await User.findById(technicianId);
    if (!tech || tech.role !== 'technician') return res.status(400).json({ message: 'Invalid technician' });

    const previous = ticket.assignedTo || null;
    ticket.assignedTo = tech._id;
    ticket.assignmentHistory.push({ from: previous, to: tech._id, by: req.user._id });
    ticket.statusHistory.push({ from: ticket.status, to: 'assigned', by: req.user._id });
    ticket.status = 'assigned';

    await ticket.save();
    const populated = await Ticket.findById(id).populate('assignedTo', 'name email phone');
    res.json({ ticket: populated });
  } catch (err) {
    next(err);
  }
};

// Add update note (CSR, technician, admin or customer owner)
exports.addUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, status } = req.body;
    if (!message) return res.status(400).json({ message: 'message required' });

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Customers can only add updates to own tickets
    if (req.user.role === 'customer' && ticket.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    ticket.updates.push({
      author: req.user._id,
      authorName: req.user.name,
      message,
      status
    });

    if (status) {
      ticket.statusHistory.push({ from: ticket.status, to: status, by: req.user._id });
      ticket.status = status;
    }

    await ticket.save();
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

// Resolve ticket (technician or csr/admin)
exports.resolveTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionSummary, resolutionCategory } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Allow technician assigned, or csr/admin
    if (!['admin', 'csr'].includes(req.user.role) && !(req.user.role === 'technician' && ticket.assignedTo && ticket.assignedTo.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    ticket.resolutionSummary = resolutionSummary || '';
    ticket.resolutionCategory = resolutionCategory || '';
    ticket.resolvedAt = new Date();
    ticket.statusHistory.push({ from: ticket.status, to: 'resolved', by: req.user._id });
    ticket.status = 'resolved';

    await ticket.save();
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

// Close ticket (CSR only, and only if resolved)
exports.closeTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Only CSR can close, and only if ticket is resolved
    if (req.user.role !== 'csr') {
      return res.status(403).json({ message: 'Only CSR can close tickets' });
    }
    if (ticket.status !== 'resolved') {
      return res.status(400).json({ message: 'Ticket must be resolved by technician before closing' });
    }

    ticket.closedAt = new Date();
    ticket.statusHistory.push({ from: ticket.status, to: 'closed', by: req.user._id });
    ticket.status = 'closed';

    await ticket.save();
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};

// Add attachment metadata (multer stores file)
exports.addAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const ticket = await Ticket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    ticket.attachments.push({
      filename: req.file.originalname,
      path: req.file.path,
      contentType: req.file.mimetype,
      uploadedBy: req.user._id
    });

    await ticket.save();
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
};
