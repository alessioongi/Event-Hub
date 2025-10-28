const pool = require('../db/config');

const createEvent = async (req, res) => {
    try {
        const { title, description, event_date, event_time, capacity, image_url, address, location, category } = req.body;
         let imageUrl = image_url;

         if (req.file) {
             imageUrl = `/uploads/${req.file.filename}`;
         }

         if (!imageUrl) {
             return res.status(400).json({ message: 'Image is required' });
         }

         // Validazione della lunghezza dell'URL dell'immagine
         if (imageUrl && imageUrl.length > 2000) { // Ho scelto 2000 come limite arbitrario, puoi modificarlo
             return res.status(400).json({ message: 'Image URL is too long. Maximum 2000 characters allowed.' });
         }

         console.log('Image URL being saved:', imageUrl); // Aggiunto per debug

         const newEvent = await pool.query(
             'INSERT INTO events (title, description, event_date, event_time, capacity, image_url, organizer_id, address, location, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING * ',
             [title, description, event_date, event_time, capacity, imageUrl, req.user.id, address, location, category]
         );
         res.status(201).json({ message: 'Event created successfully', event: newEvent.rows[0] });
     } catch (error) {
         console.error('Error creating event:', error);
         res.status(500).json({ message: 'Server error' });
     }
 };

const getPendingEvents = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT e.*, u.name as organizer_name FROM events e JOIN users u ON e.organizer_id = u.id WHERE e.status = $1 ORDER BY e.event_date DESC',
            ['pending']
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching pending events:', error);
        res.status(500).json({ message: 'Error fetching pending events' });
    }
};

const approveEvent = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE events SET status = $1 WHERE id = $2 RETURNING * ',
            ['approved', id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }
        res.status(200).json({ message: 'Evento approvato con successo', event: result.rows[0] });
    } catch (error) {
        console.error('Error approving event:', error);
        res.status(500).json({ message: 'Error approving event' });
    }
};

const rejectEvent = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE events SET status = $1 WHERE id = $2 RETURNING * ',
            ['rejected', id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }
        res.status(200).json({ message: 'Evento rifiutato con successo', event: result.rows[0] });
    } catch (error) {
        console.error('Error rejecting event:', error);
        res.status(500).json({ message: 'Error rejecting event' });
    }
};

const getAllEvents = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT e.*, u.name as organizer_name FROM events e JOIN users u ON e.organizer_id = u.id WHERE e.status = $1 ORDER BY e.event_date DESC',
            ['approved']
        );
        console.log('Fetched events with image URLs:', result.rows.map(event => ({ id: event.id, title: event.title, image_url: event.image_url, time: event.time }))); // Aggiunto per debug
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error fetching events' });
    }
};

const getMyCreatedEvents = async (req, res) => {
    const user_id = req.user.id;
    try {
        const result = await pool.query(
            'SELECT e.*, u.name as organizer_name FROM events e JOIN users u ON e.organizer_id = u.id WHERE e.organizer_id = $1 ORDER BY e.created_at DESC',
            [user_id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching my created events:', error);
        res.status(500).json({ message: 'Error fetching my created events' });
    }
};

const searchEvents = async (req, res) => {
    const { date, location, category } = req.query;
    let query = 'SELECT e.*, u.name as organizer_name FROM events e JOIN users u ON e.organizer_id = u.id WHERE e.status = \'approved\'';
    const params = [];
    let paramIndex = 1;

    if (date) {
        query += ` AND event_date >= $${paramIndex}::date AND event_date < ($${paramIndex}::date + INTERVAL '1 day')`;
        params.push(date);
        paramIndex++;
    }

    if (location) {
        query += ` AND location ILIKE $${paramIndex}`;
        params.push(`%${location}%`);
        paramIndex++;
    }

    if (category) {
        query += ` AND category ILIKE $${paramIndex}`;
        params.push(`%${category}%`);
        paramIndex++;
    }

    query += ' ORDER BY event_date DESC';

    try {
        const result = await pool.query(query, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error searching events:', error);
        res.status(500).json({ message: 'Error searching events' });
    }
};

const registerForEvent = async (req, res) => {
    const { event_id } = req.body;
    const user_id = req.user.id;

    try {
        // Check if the user is already registered
        const existingRegistration = await pool.query(
            'SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2',
            [event_id, user_id]
        );

        if (existingRegistration.rows.length > 0) {
            return res.status(400).json({ message: 'Sei già iscritto a questo evento.' });
        }

        // Check event capacity
        const event = await pool.query('SELECT capacity FROM events WHERE id = $1', [event_id]);
        if (event.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato.' });
        }
        if (event.rows[0].capacity <= 0) {
            return res.status(400).json({ message: 'Capacità massima raggiunta per questo evento.' });
        }

        // Register user and decrease capacity
        await pool.query(
            'INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2)',
            [event_id, user_id]
        );
        await pool.query(
            'UPDATE events SET capacity = capacity - 1 WHERE id = $1',
            [event_id]
        );

        res.status(201).json({ message: 'Iscrizione all\\\'evento riuscita!' });
    } catch (error) {
        console.error('Errore durante l\\\'iscrizione all\\\'evento:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
};

const unregisterFromEvent = async (req, res) => {
    const { event_id } = req.body;
    const user_id = req.user.id;

    try {
        // Check if the user is registered
        const existingRegistration = await pool.query(
            'SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2',
            [event_id, user_id]
        );

        if (existingRegistration.rows.length === 0) {
            return res.status(400).json({ message: 'Non sei iscritto a questo evento.' });
        }

        // Unregister user and increase capacity
        await pool.query(
            'DELETE FROM event_registrations WHERE event_id = $1 AND user_id = $2',
            [event_id, user_id]
        );
        await pool.query(
            'UPDATE events SET capacity = capacity + 1 WHERE id = $1',
            [event_id]
        );

        res.status(200).json({ message: 'Disiscrizione dall\\\'evento riuscita!' });
    } catch (error) {
        console.error('Errore durante la disiscrizione dall\\\'evento:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
};

const getMyRegisteredEvents = async (req, res) => {
    const user_id = req.user.id; // Assumendo che l\'ID utente sia disponibile in req.user.id
    console.log('getMyRegisteredEvents: user_id from token:', user_id); // Log per debug

    try {
        const result = await pool.query(
            'SELECT e.*, u.name as organizer_name FROM events e JOIN users u ON e.organizer_id = u.id JOIN event_registrations r ON e.id = r.event_id WHERE r.user_id = $1 ORDER BY e.event_date DESC',
            [user_id]
        );
        console.log('getMyRegisteredEvents: Registered events for user', user_id, ':', result.rows.map(event => event.id)); // Log per debug
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching registered events:', error);
        res.status(500).json({ message: 'Error fetching registered events' });
    }
};

const getEventById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT e.*, u.name as organizer_name FROM events e JOIN users u ON e.organizer_id = u.id WHERE e.id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching event by ID:', error);
        res.status(500).json({ message: 'Error fetching event by ID' });
    }
};

const updateEvent = async (req, res) => {
    const { id } = req.params;
    const { title, description, event_date, capacity } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url_existing; // Mantieni l'immagine esistente se non viene caricata una nuova

    try {
        const result = await pool.query(
            'UPDATE events SET title = $1, description = $2, event_date = $3, capacity = $4, image_url = $5 WHERE id = $6 RETURNING *',
            [title, description, event_date, capacity, image_url, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }
        res.status(200).json({ message: 'Evento aggiornato con successo', event: result.rows[0] });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'Error updating event' });
    }
};

const deleteEvent = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    const user_role = req.user.role;

    try {
        // Recupera l'evento per verificare l'organizzatore
        const eventResult = await pool.query('SELECT organizer_id FROM events WHERE id = $1', [id]);

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }

        const event = eventResult.rows[0];

        // Verifica se l'utente è l'organizzatore o un amministratore
        if (event.organizer_id !== user_id && user_role !== 'admin') {
            return res.status(403).json({ message: 'Non autorizzato ad eliminare questo evento' });
        }

        const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato dopo la verifica dell\'autorizzazione' });
        }
        res.status(200).json({ message: 'Evento eliminato con successo' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createEvent, getAllEvents, searchEvents, registerForEvent, unregisterFromEvent, getMyRegisteredEvents, getEventById, updateEvent, deleteEvent, getPendingEvents, approveEvent, rejectEvent, getMyCreatedEvents };