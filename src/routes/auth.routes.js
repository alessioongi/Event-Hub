const express = require('express');
const router = express.Router();
const { register, login, logout, forgotPassword, resetPassword, checkSession, getUserData } = require('../controllers/auth.controller');
const { authorize } = require('../middleware/auth.middleware');
const { registerValidation, loginValidation, forgotPasswordValidation, resetPasswordValidation } = require('../validation/auth.validation');

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);
router.post('/reset-password', resetPasswordValidation, resetPassword);
router.get('/check-session', checkSession);
router.get('/user-data', getUserData);

module.exports = router;