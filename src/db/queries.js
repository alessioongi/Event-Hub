const db = require('./config');

const queries = {
    // Inserisce un nuovo utente
    createUser: async (name, email, password) => {
        const newUserId = await queries.findLowestAvailableUserId();
        const query = `
            INSERT INTO users (id, name, email, password)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email, created_at
        `;
        const values = [newUserId, name, email, password];
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
        const query = 'SELECT id, name, email, created_at, role, is_blocked FROM users WHERE id = $1';
        try {
            const result = await db.query(query, [id]);
            return result.rows[0];
        } catch (err) {
            throw err;
        }
    },

    // Aggiorna lo stato di blocco di un utente
    updateUserBlockStatus: async (userId, isBlocked) => {
        const query = 'UPDATE users SET is_blocked = $1 WHERE id = $2 RETURNING id, name, email, is_blocked';
        const values = [isBlocked, userId];
        try {
            const result = await db.query(query, values);
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
    },

    // Elimina i messaggi della chat per ID evento
    deleteChatMessagesByEventId: async (eventId) => {
        console.log(`Attempting to delete chat messages for event ID: ${eventId}`);
        try {
            const result = await db.query('DELETE FROM chat_messages WHERE event_id = $1', [eventId]);
            console.log(`Successfully deleted chat messages for event ID: ${eventId}. Rows affected: ${result.rowCount}`);
            return result;
        } catch (error) {
            console.error(`Error deleting chat messages for event ID: ${eventId}:`, error);
            throw error;
        }
    },

    findLowestAvailableEventId: async () => {
        try {
            const result = await db.query(`
                SELECT s.i AS lowest_id
                FROM generate_series(1, (SELECT MAX(id) + 1 FROM events)) s(i)
                WHERE NOT EXISTS (SELECT 1 FROM events WHERE id = s.i)
                ORDER BY s.i
                LIMIT 1;
            `);
            if (result.rows.length > 0) {
                return result.rows[0].lowest_id;
            } else {
                // If no gaps, return MAX(id) + 1 or 1 if table is empty
                const maxIdResult = await db.query('SELECT MAX(id) FROM events');
                return (maxIdResult.rows[0].max || 0) + 1;
            }
        } catch (error) {
            console.error('Error finding lowest available event ID:', error);
            throw error;
        }
    },

    findLowestAvailableUserId: async () => {
        try {
            const result = await db.query(`
                SELECT s.i AS lowest_id
                FROM generate_series(1, (SELECT MAX(id) + 1 FROM users)) s(i)
                WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = s.i)
                ORDER BY s.i
                LIMIT 1;
            `);
            if (result.rows.length > 0) {
                return result.rows[0].lowest_id;
            } else {
                const maxIdResult = await db.query('SELECT MAX(id) FROM users');
                return (maxIdResult.rows[0].max || 0) + 1;
            }
        } catch (error) {
            console.error('Error finding lowest available user ID:', error);
            throw error;
        }
    }
};

module.exports = queries;