const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const db = require('../db/config');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      const result = await db.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);
      req.user = result.rows[0];
      if (!req.user) {
        console.error('User not found for decoded token ID.');
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }
      next();
    } catch (error) {
      console.error('Error in auth middleware (token verification/user lookup):', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
      return;
    }
  }
  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }
});

const authorize = (...roles) => {
  return (req, res, next) => {
    // Se non sono specificati ruoli, qualsiasi utente autenticato può accedere
    if (roles.length === 0) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`User role ${req.user.role} is not authorized to access this route`);
    }
    next();
  };
};

module.exports = { protect, authorize };