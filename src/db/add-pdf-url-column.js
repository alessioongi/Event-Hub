require('dotenv').config();
const db = require('./config');

async function addPdfUrlColumn() {
    try {
        await db.query('ALTER TABLE events ADD COLUMN pdf_url TEXT;');
        console.log('Colonna pdf_url aggiunta con successo alla tabella events.');
    } catch (error) {
        if (error.code === '42701') {
            console.log('La colonna pdf_url esiste già.');
        } else {
            console.error('Errore durante l\'aggiunta della colonna pdf_url:', error);
        }
    } finally {
        db.pool.end(); // Chiudi la connessione al database
    }
}

addPdfUrlColumn();