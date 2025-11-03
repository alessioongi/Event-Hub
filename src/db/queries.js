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
    insertChatMessage: async (eventId, userId, message) => {
        const query = `
            INSERT INTO chat_messages (event_id, user_id, message)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const values = [eventId, userId, message];
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
            SELECT cm.*, u.name as user_name
            FROM chat_messages cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.event_id = $1
            ORDER BY cm.timestamp ASC
        `;
        try {
            const result = await db.query(query, [eventId]);
            return result.rows;
        } catch (err) {
            throw err;
        }
    }
};

module.exports = queries;