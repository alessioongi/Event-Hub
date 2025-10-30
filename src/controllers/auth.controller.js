const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../db/config');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/emailService');

// Genera il token JWT
const generateToken = (id) => {
  // Generate JWT
  const token = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1h',
  });
  // console.log('JWT_SECRET used for signing:', process.env.JWT_SECRET);
  // console.log('Generated Token:', token);

  return token;
};

// Registrazione utente
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Verifica se l'utente esiste già
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: 'Un utente con questa email esiste già'
      });
    }

    // Hash della password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crea nuovo utente
    const result = await db.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );
    const user = result.rows[0];

    // Genera token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'Utente registrato con successo',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Errore durante la registrazione:', error);
    next(error);
  }
};

// Login utente
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Verifica se l'utente esiste
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'Email o password non validi'
      });
    }

    const user = result.rows[0];

    // Verifica la password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Email o password non validi'
      });
    }

    // Genera token
    const token = generateToken(user.id);
    console.log('Generated Token:', token); // Aggiunto per debug

    // Imposta la sessione
    req.session.userId = user.id;
    req.session.userRole = user.role;

    res.json({
      message: 'Login effettuato con successo',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// Logout utente
exports.logout = (req, res) => {
  res.json({
    message: 'Logout effettuato con successo'
  });
};

// Richiesta reset password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log('Richiesta reset password per:', email);

    // Verifica se l'utente esiste
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      console.log('Utente non trovato per email:', email);
      return res.status(404).json({
        message: 'Nessun utente trovato con questa email'
      });
    }

    const user = result.rows[0];
    console.log('Utente trovato:', user.id);

    // Genera token di reset
    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '1h'
    });
    console.log('Token generato:', resetToken);

    // Salva il token nel database
    await db.query(
      'UPDATE users SET reset_password_token = $1, reset_password_expire = $2 WHERE id = $3',
      [resetToken, new Date(Date.now() + 3600000), user.id]
    );
    console.log('Token salvato nel database');

    // URL di reset
    const resetUrl = `http://localhost:3000/reset-password.html?token=${resetToken}`;
    console.log('URL di reset generato:', resetUrl);

    // Contenuto email
    const emailContent = `
        <h1>Richiesta di Reset Password</h1>
        <p>Hai richiesto il reset della password. Clicca sul link seguente per procedere:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>Il link scadrà tra 1 ora.</p>
        <p>Se non hai richiesto il reset della password, ignora questa email.</p>
      `;

    try {
      // Invia email
      console.log('Tentativo di invio email...');
      const emailResult = await sendEmail(email, 'Reset Password - EventHub', emailContent);

      if (emailResult.success) {
        console.log('Email inviata con successo');
        res.json({
          message: 'Email di reset password inviata con successo'
        });
      } else {
        console.error('Errore nell\'invio dell\'email:', emailResult.error);
        return res.status(500).json({ message: 'Errore nell\'invio dell\'email di reset password' });
      }
    } catch (emailError) {
      console.error('Errore dettagliato nell\'invio dell\'email:', emailError);
      throw emailError;
    }
  } catch (error) {
    console.error('Errore completo:', error);
    next(error);
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    // Verifica il token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verifica se il token è valido e non scaduto
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1 AND reset_password_token = $2 AND reset_password_expire > $3',
      [decoded.id, token, new Date()]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: 'Token di reset non valido o scaduto'
      });
    }

    // Aggiorna la password e rimuovi il token di reset
    await db.query(
      'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expire = NULL WHERE id = $2',
      [newPassword, decoded.id]
    );

    res.json({
      message: 'Password aggiornata con successo'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        message: 'Il token di reset è scaduto'
      });
    }
    next(error);
  }
};

// Verifica sessione utente
exports.checkSession = async (req, res) => {
  if (req.session && req.session.userId) {
    const userResult = await db.query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    const userRole = userResult.rows.length > 0 ? userResult.rows[0].role : 'user'; // Default to 'user' if role not found
    res.status(200).json({ isAuthenticated: true, userId: req.session.userId, role: userRole });
  } else {
    res.status(401).json({ isAuthenticated: false });
  }
};

// Ottieni dati utente
exports.getUserData = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Non autenticato' });
    }

    const result = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    const user = result.rows[0];
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};