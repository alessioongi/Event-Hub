const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

console.log('PG_REJECT_UNAUTHORIZED value at pool creation:', process.env.PG_REJECT_UNAUTHORIZED);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.PG_REJECT_UNAUTHORIZED === 'false' ? false : true
  }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};