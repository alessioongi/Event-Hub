const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: 'postgres://avnadmin:AVNS_LBLUquFtRp1pdNO5vU-@pg-325a2e73-bid-it-2024-2026.e.aivencloud.com:20048/event_hub',
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};