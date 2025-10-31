const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const connectionString = process.env.DATABASE_URL;
const parsedConfig = parse(connectionString);

// Rimuovi sslmode dalla configurazione analizzata per evitare sovrascritture
if (parsedConfig.sslmode) {
  delete parsedConfig.sslmode;
}

const pool = new Pool({
    ...parsedConfig,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};