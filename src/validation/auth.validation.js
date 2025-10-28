const { body } = require('express-validator');

const registerValidation = [
    body('name').notEmpty().withMessage('Il nome è richiesto'),
    body('email').isEmail().withMessage(`L'email non è valida`),
    body('password').isLength({ min: 6 }).withMessage('La password deve essere lunga almeno 6 caratteri')
];

const loginValidation = [
    body('email').isEmail().withMessage(`L'email non è valida`),
    body('password').notEmpty().withMessage('La password è richiesta')
];

const forgotPasswordValidation = [
    body('email').isEmail().withMessage(`L'email non è valida`)
];

const resetPasswordValidation = [
    body('token').notEmpty().withMessage('Il token è richiesto'),
    body('password').isLength({ min: 6 }).withMessage('La password deve essere lunga almeno 6 caratteri')
];

module.exports = {
    registerValidation,
    loginValidation,
    forgotPasswordValidation,
    resetPasswordValidation
};