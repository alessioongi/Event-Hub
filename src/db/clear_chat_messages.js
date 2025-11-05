require('dotenv').config();
const { pool } = require('./config');

async function clearChatMessages() {
    try {
        console.log('Eliminazione di tutti i messaggi della chat...');
        await pool.query('DELETE FROM chat_messages');
        console.log('Tutti i messaggi della chat sono stati eliminati con successo.');
    } catch (err) {
        console.error('Errore durante l\'eliminazione dei messaggi della chat:', err);
    } finally {
        await pool.end();
    }
}

clearChatMessages();