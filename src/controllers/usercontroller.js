// Admin updates user (password or general)
exports.updatePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (password) {
      // Update password
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.password = password;
      await user.save();
      res.json({ message: 'Password updated' });
    } else {
      // General update
      const updates = { ...req.body };
      delete updates.password; // do not change password here
      const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ user });
    }
  } catch (err) {
    next(err);
  }
};
// src/controllers/userController.js
const User = require('../models/user');

// List users (admin, or csr for technicians only)
exports.listUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (role) filter.role = role;

    // Only admin can list all users; csr can list all or technicians
    if (req.user.role !== 'admin') {
      if (req.user.role === 'csr' && (!role || role === 'technician')) {
        // allow
      } else {
        return res.status(403).json({ message: 'Forbidden: insufficient privileges' });
      }
    }

    const users = await User.find(filter)
      .select('-password')
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10))
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (err) {
    next(err);
  }
};

// Admin creates users (csr/technician/admin/customer/contractor)
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, specialization, deviceType, firstName, otherNames, accountNumber, customerSegment, serviceType, routerMacAddress, location, billingPlan } = req.body;
    if (!name || !email || !role || !phone) return res.status(400).json({ message: 'Missing required fields: name, email, role, phone' });
    if (!['csr', 'technician', 'admin', 'customer', 'contractor'].includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const userData = { name, email, role, phone };
    if (password) userData.password = password;
    else userData.password = 'TempPass123!'; // Default password for bulk uploads

    const user = new User(userData);
    if ((role === 'technician' || role === 'contractor') && specialization) {
      user.specialization = specialization;
    }
    if (role === 'customer') {
      if (deviceType) user.deviceType = deviceType;
      if (firstName) user.firstName = firstName;
      if (otherNames) user.otherNames = otherNames;
      if (accountNumber) user.accountNumber = accountNumber;
      if (customerSegment) user.customerSegment = customerSegment;
      if (serviceType) user.serviceType = serviceType;
      if (routerMacAddress) user.routerMacAddress = routerMacAddress;
      if (location) user.location = location;
      if (billingPlan) user.billingPlan = billingPlan;
    }
    await user.save();

    res.status(201).json({ user: user.toJSON() });
  } catch (err) {
    next(err);
  }
};

// Admin updates user
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.password; // do not change password here
    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

// Admin deletes user
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

// Bulk upload users from file
exports.bulkCreateUsers = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const filePath = req.file.path;
    const fileExt = req.file.originalname.split('.').pop().toLowerCase();

    let data = [];
    console.log('File extension:', fileExt);
    try {
      if (fileExt === 'xlsx' || fileExt === 'xls') {
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
        console.log('Parsed Excel data length:', data.length);
      } else if (fileExt === 'csv') {
        const fs = require('fs');
        const csv = fs.readFileSync(filePath, 'utf8');
        const lines = csv.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim());
          console.log('CSV headers:', headers);
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, idx) => obj[h] = values[idx] || '');
            data.push(obj);
          }
        }
        console.log('Parsed CSV data length:', data.length);
      } else if (fileExt === 'pdf') {
        const fs = require('fs');
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        console.log('PDF text length:', pdfData.text.length);
        // Simple parsing: assume text is CSV-like
        const lines = pdfData.text.split('\n').filter(line => line.trim());
        console.log('PDF lines:', lines.length);
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim());
          console.log('PDF headers:', headers);
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, idx) => obj[h] = values[idx] || '');
            data.push(obj);
          }
        }
      } else if (fileExt === 'docx' || fileExt === 'doc') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        console.log('Word text length:', result.value.length);
        // Simple parsing: assume text is CSV-like
        const lines = result.value.split('\n').filter(line => line.trim());
        console.log('Word lines:', lines.length);
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim());
          console.log('Word headers:', headers);
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, idx) => obj[h] = values[idx] || '');
            data.push(obj);
          }
        }
      } else {
        return res.status(400).json({ message: 'Unsupported file type' });
      }
    } catch (parseErr) {
      console.log('Parsing error:', parseErr.message);
      return res.status(400).json({ message: 'Failed to parse file: ' + parseErr.message });
    }
    console.log('Total data rows:', data.length);

    const users = [];
    const errors = [];
    console.log('Processing rows...');
    for (const [index, row] of data.entries()) {
      try {
        console.log(`Row ${index}:`, row);
        const userData = {
          name: row.name || row.Name || row.fullname || row.Fullname || row['Customer Name'] || row['customer name'] || '',
          email: row.email || row.Email || row['Email address'] || row['email address'] || '',
          phone: row.phone || row.Phone || row.mobile || row.Mobile || row['Phone Number'] || row['phone number'] || '',
          role: 'customer', // Only customers for bulk upload
          password: row.password || row.Password || 'TempPass123!', // default password
          deviceType: row.deviceType || row['Device Type'] || row.devicetype || row.DeviceType || '',
          firstName: row.firstName || row['First Name'] || row.firstname || row.Firstname || '',
          otherNames: row.otherNames || row['Other Names'] || row.othernames || row.Othernames || '',
          accountNumber: row.accountNumber || row['Account Number'] || row.accountnumber || row.Accountnumber || '',
          customerSegment: row.customerSegment || row['Customer Segment'] || row.customersegment || row.Customersegment || row.pop || row.POP || '',
          serviceType: row.serviceType || row['Service Type'] || row.servicetype || row.Servicetype || '',
          routerMacAddress: row.routerMacAddress || row['Router MAC Address'] || row.routermacaddress || row.Routermacaddress || '',
          location: row.location || row.Location || row['Location'] || '',
          billingPlan: row.billingPlan || row['Billing Plan'] || row.billingplan || row.Billingplan || ''
        };

        console.log(`UserData for row ${index}:`, userData);

        if (!userData.email) {
          console.log(`Row ${index} missing email`);
          errors.push({ row, error: 'Missing required field: email' });
          continue;
        }

        const existing = await User.findOne({ email: userData.email });
        if (existing) {
          console.log(`Row ${index} email already in use: ${userData.email}`);
          errors.push({ row, error: 'Email already in use' });
          continue;
        }

        const user = new User(userData);
        await user.save();
        users.push(user.toJSON());
        console.log(`Row ${index} saved successfully`);
      } catch (err) {
        console.log(`Row ${index} error:`, err.message);
        errors.push({ row, error: err.message });
      }
    }
    console.log('Users saved:', users.length, 'Errors:', errors.length);

    // Clean up file
    const fs = require('fs');
    setTimeout(() => fs.unlink(filePath, () => {}), 1000); // Delay unlink to avoid EBUSY

    res.status(201).json({ users, errors, message: `Uploaded ${users.length} users, ${errors.length} errors` });
  } catch (err) {
    next(err);
  }
};
