const pool = require('../db/config');
const bcrypt = require('bcryptjs');

// User model for PostgreSQL
const User = {
  // Method to find a user by ID
  findById: async (id) => {
    const result = await pool.query('SELECT id, name, email, password, reset_password_token, reset_password_expire, created_at FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Method to find a user by email
  findByEmail: async (email) => {
    const result = await pool.query('SELECT id, name, email, password, reset_password_token, reset_password_expire, created_at FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  // Method to create a new user
  create: async (name, email, password) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hashedPassword]
    );
    return result.rows[0];
  },

  // Method to compare password
  comparePassword: async (candidatePassword, hashedPassword) => {
    return bcrypt.compare(candidatePassword, hashedPassword);
  },

  // Method to save reset token
  saveResetToken: async (userId, resetToken) => {
    const result = await pool.query(
      'UPDATE users SET reset_password_token = $1, reset_password_expire = $2 WHERE id = $3 RETURNING *',
      [resetToken, Date.now() + 3600000, userId] // 1 hour expiration
    );
    return result.rows[0];
  },

  // Method to update password
  updatePassword: async (userId, newPassword) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    const result = await pool.query(
      'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expire = NULL WHERE id = $2 RETURNING *',
      [hashedPassword, userId]
    );
    return result.rows[0];
  },

  // Method to invalidate reset token
  invalidateResetToken: async (userId) => {
    const result = await pool.query(
      'UPDATE users SET reset_password_token = NULL, reset_password_expire = NULL WHERE id = $1 RETURNING *',
      [userId]
    );
    return result.rows[0];
  },
};

module.exports = User;