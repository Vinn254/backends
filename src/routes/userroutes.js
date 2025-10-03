// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/usercontroller');
const { authMiddleware, requireRole } = require('../middleware/authmiddleware');
const multer = require('multer');
const path = require('path');

// Multer setup for bulk upload
const upload = multer({
  dest: path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    const allowedExt = ['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});


// All routes require authentication
router.use(authMiddleware);

// Allow CSRs to GET /users?role=technician, all else admin only
router.get('/', (req, res, next) => {
	if (req.user.role === 'admin') return userController.listUsers(req, res, next);
	if (req.user.role === 'csr' && req.query.role === 'technician') return userController.listUsers(req, res, next);
	return res.status(403).json({ message: 'Forbidden: insufficient privileges' });
});

// All other user management routes require admin
router.use(requireRole(['admin']));
router.post('/', userController.createUser);
router.post('/bulk', upload.single('file'), userController.bulkCreateUsers);
router.put('/:id', userController.updateUser);
router.patch('/:id', userController.updatePassword); // PATCH for password update
router.delete('/:id', userController.deleteUser);

module.exports = router;
