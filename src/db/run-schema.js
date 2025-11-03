require('dotenv').config();
const { pool } = require('./config');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

async function runSchema() {
    try {
        try {
            console.log('Esecuzione dello script schema.sql...');
            const sqlPath = path.join(__dirname, 'schema.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await pool.query(sql);
            console.log('Schema del database inizializzato con successo.');
        } catch (err) {
            console.warn('Attenzione: Errore durante l\'esecuzione di schema.sql (potrebbe essere già esistente): ', err.message);
        }

        try {
            console.log('Esecuzione dello script update_schema.sql...');
            const updateSqlPath = path.join(__dirname, 'update_schema.sql');
            const updateSql = fs.readFileSync(updateSqlPath, 'utf8');
            await pool.query(updateSql);
            console.log('Schema del database aggiornato con successo.');
        } catch (err) {
            console.warn('Attenzione: Errore durante l\'esecuzione di update_schema.sql (potrebbe essere già esistente): ', err.message);
        }

        try {
            console.log('Esecuzione dello script create_chat_messages_table.sql...');
            const chatMessagesSqlPath = path.join(__dirname, 'create_chat_messages_table.sql');
            const chatMessagesSql = fs.readFileSync(chatMessagesSqlPath, 'utf8');
            await pool.query(chatMessagesSql);
            console.log('Tabella chat_messages creata con successo.');
        } catch (err) {
            console.warn('Attenzione: Errore durante l\'esecuzione di create_chat_messages_table.sql (potrebbe essere già esistente): ', err.message);
        }

        try {
            console.log('Esecuzione dello script add_is_blocked_column_to_users.sql...');
            const addIsBlockedSqlPath = path.join(__dirname, 'add_is_blocked_column_to_users.sql');
            const addIsBlockedSql = fs.readFileSync(addIsBlockedSqlPath, 'utf8');
            await pool.query(addIsBlockedSql);
            console.log('Colonna is_blocked aggiunta alla tabella users con successo.');
        } catch (err) {
            console.warn('Attenzione: Errore durante l\'esecuzione di add_is_blocked_column_to_users.sql (potrebbe essere già esistente): ', err.message);
        }

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