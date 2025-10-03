// src/routes/ticketRoutes.js
const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketcontroller');
const { authMiddleware, requireRole } = require('../middleware/authmiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, unique);
  }
});
const upload = multer({ storage });

// All ticket routes require authentication
router.use(authMiddleware);

// Customers create tickets
router.post('/', ticketController.createTicket);

// List & filter tickets - CSR/Admin sees more; customers see own (controller enforces)
router.get('/', ticketController.getTickets);

// Get ticket by id
router.get('/:id', ticketController.getTicketById);

// Update ticket (limited fields) - CSR/Admin or assigned technician
router.put('/:id', ticketController.updateTicket);

// Assign ticket - CSR/Admin only
router.patch('/:id/assign', requireRole(['csr', 'admin']), ticketController.assignTicket);

// Add update (notes) - CSR, technician, admin, or owner customer
router.post('/:id/updates', ticketController.addUpdate);

// Resolve - technician or CSR/Admin
router.patch('/:id/resolve', ticketController.resolveTicket);

// Close - Technician/CSR/Admin
router.patch('/:id/close', requireRole(['csr', 'admin', 'technician']), ticketController.closeTicket);

// Attachments
router.post('/:id/attachments', upload.single('file'), ticketController.addAttachment);

module.exports = router;
