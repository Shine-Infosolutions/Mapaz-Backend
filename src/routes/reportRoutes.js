const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth, authorize } = require('../middleware/auth');

// Night Audit Report
router.get('/night-audit', auth, authorize(['ADMIN', 'GM', 'FRONT DESK', 'ACCOUNTS']), reportController.getNightAuditReport);

module.exports = router;