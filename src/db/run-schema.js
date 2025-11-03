require('dotenv').config();
const { pool } = require('./config');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

async function runSchema() {
    try {
        console.log('Esecuzione dello script schema.sql...');
        const sqlPath = path.join(__dirname, 'schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log('Schema del database inizializzato con successo.');

        console.log('Esecuzione dello script update_schema.sql...');
        const updateSqlPath = path.join(__dirname, 'update_schema.sql');
        const updateSql = fs.readFileSync(updateSqlPath, 'utf8');
        await pool.query(updateSql);
        console.log('Schema del database aggiornato con successo.');

        console.log('Esecuzione dello script create_chat_messages_table.sql...');
        const chatMessagesSqlPath = path.join(__dirname, 'create_chat_messages_table.sql');
        const chatMessagesSql = fs.readFileSync(chatMessagesSqlPath, 'utf8');
        await pool.query(chatMessagesSql);
        console.log('Tabella chat_messages creata con successo.');

        // Verifica se esiste già un utente admin
        const adminCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@test.com']);
        if (adminCheck.rows.length === 0) {
            // Crea l'utente admin se non esiste
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            await pool.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
                ['Admin Test', 'admin@test.com', hashedPassword, 'admin']
            );
            console.log('Utente admin creato con successo.');
        }

        // Verifica se esiste già un utente normale (Alessio)
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['alessio.ongi@gmail.com']);
        if (userCheck.rows.length === 0) {
            // Crea l'utente normale se non esiste
            const hashedPasswordUser = bcrypt.hashSync('1', 10); // Password '1'
            await pool.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
                ['Alessio', 'alessio.ongi@gmail.com', hashedPasswordUser, 'user']
            );
            console.log('Utente normale (Alessio) creato con successo.');
        }

    } catch (err) {
        console.error('Errore durante l\'esecuzione dello script schema.sql:', err);
    } finally {
        await pool.end(); // Chiudi il pool di connessioni dopo l'esecuzione
    }
}

runSchema();