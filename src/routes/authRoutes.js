const express = require('express');
const { register, login, getProfile, checkStatus } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', auth, getProfile);
router.get('/check-status', auth, checkStatus);

module.exports = router; 

