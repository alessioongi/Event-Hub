const db = require('./config');

const queries = {
    // Inserisce un nuovo utente
    createUser: async (name, email, password) => {
        const query = `
            INSERT INTO users (name, email, password)
            VALUES ($1, $2, $3)
            RETURNING id, name, email, created_at
        `;
        const values = [name, email, password];
        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (err) {
            throw err;
        }
    },

    // Trova un utente per email
    findUserByEmail: async (email) => {
        const query = 'SELECT * FROM users WHERE email = $1';
        try {
            const result = await db.query(query, [email]);
            return result.rows[0];
        } catch (err) {
            throw err;
        }
    },

    // Trova un utente per ID
    findUserById: async (id) => {
        const query = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
        try {
            const result = await db.query(query, [id]);
            return result.rows[0];
        } catch (err) {
            throw err;
        }
    },
    // Inserisce un nuovo messaggio di chat
    insertChatMessage: async (eventId, userId, username, message) => {
        const query = `
            INSERT INTO chat_messages (event_id, user_id, username, message_text)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const values = [eventId, userId, username, message];
        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (err) {
            throw err;
        }
    },

    // Recupera i messaggi della chat per ID evento
    getChatMessagesByEventId: async (eventId) => {
        const query = `
            SELECT cm.message_text, COALESCE(u.name, 'Utente Sconosciuto') as user_name
            FROM chat_messages cm
            LEFT JOIN users u ON cm.user_id = u.id
            WHERE cm.event_id = $1
            ORDER BY cm.created_at ASC
        `;
        try {
            const result = await db.query(query, [eventId]);
            console.log('Messaggi chat recuperati dal DB:', result.rows);
            return result.rows;
        } catch (err) {
            throw err;
        }
    },

    getUsernameById: async (userId) => {
        const query = `
            SELECT name FROM users WHERE id = $1
        `;
        try {
            const result = await db.query(query, [userId]);
            return result.rows[0] ? result.rows[0].name : null;
        } catch (err) {
            console.error('Errore nel recupero del nome utente:', err);
            throw err;
        }
    }
};

module.exports = queries;