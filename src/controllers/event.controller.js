const pool = require('../db/config');
const { sendEmail } = require('../utils/emailService');
const queries = require('../db/queries');
const { getChatMessagesByEventId, findLowestAvailableEventId } = queries;
const asyncHandler = require('express-async-handler');

const createEvent = asyncHandler(async (req, res) => {
    const { title, description, event_date, event_time, capacity, image_url, address, location, category } = req.body;
    let finalImageUrl = image_url;
    let finalPdfUrl = null; // Initialize to null

    if (req.files && req.files.pdf_file && req.files.pdf_file[0]) {
        finalPdfUrl = '/uploads/' + req.files.pdf_file[0].filename;
    }

    if (!finalImageUrl) {
        return res.status(400).json({ message: 'Image URL is required' });
    }

    // Validazione della lunghezza dell'URL dell'immagine
    if (finalImageUrl && finalImageUrl.length > 2000) {
        return res.status(400).json({ message: 'Image URL is too long. Maximum 2000 characters allowed.' });
    }

    // Validazione della lunghezza dell'URL del PDF
    if (finalPdfUrl && finalPdfUrl.length > 2000) {
        return res.status(400).json({ message: 'PDF URL is too long. Maximum 2000 characters allowed.' });
    }

    console.log('Image URL being saved:', finalImageUrl); // Aggiunto per debug
    console.log('PDF URL being saved:', finalPdfUrl); // Aggiunto per debug

    const newEventId = await findLowestAvailableEventId();

    const newEvent = await pool.query(
        'INSERT INTO events (id, title, description, event_date, event_time, capacity, image_url, pdf_url, organizer_id, address, location, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING * ',
        [newEventId, title, description, event_date, event_time, capacity, finalImageUrl, finalPdfUrl, req.user.id, address, location, category]
    );

    // Invia notifica agli admin per il nuovo evento in attesa di approvazione
    const admins = await pool.query('SELECT email FROM users WHERE role = $1', ['admin']);
    const adminEmails = admins.rows.map(admin => admin.email);

    if (adminEmails.length > 0) {
        const adminSubject = 'Nuovo Evento in Attesa di Approvazione';
        const adminHtmlContent = `
            <h1>Nuovo Evento Creato</h1>
            <p>Un nuovo evento, <strong>${title}</strong>, è stato creato ed è in attesa della tua approvazione.</p>
            <p>Descrizione: ${description}</p>
            <p>Data: ${event_date} ${event_time}</p>
            <p>Organizzatore: ${req.user.name || req.user.email}</p>
            <p>Per approvare o rifiutare l'evento, visita la pagina di amministrazione.</p>
            <a href="http://localhost:3000/admin-page.html">Vai alla pagina Admin</a>
        `;
        await sendEmail(adminEmails.join(','), adminSubject, adminHtmlContent);
    }

    res.status(201).json({ message: 'Event created successfully', event: newEvent.rows[0] });
});

const getPendingEvents = asyncHandler(async (req, res) => {
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
});

const approveEvent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE events SET status = $1 WHERE id = $2 RETURNING * ',
            ['approved', id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }

        const approvedEvent = result.rows[0];
        const organizer = await pool.query('SELECT email FROM users WHERE id = $1', [approvedEvent.organizer_id]);
        const organizerEmail = organizer.rows[0].email;

        const subject = 'Il tuo evento è stato approvato!';
        const htmlContent = `
            <h1>Evento Approvato</h1>
            <p>Congratulazioni! Il tuo evento, <strong>${approvedEvent.title}</strong>, è stato approvato.</p>
            <p>Ora è visibile al pubblico.</p>
            <a href="http://localhost:3000/event-details.html?id=${approvedEvent.id}">Visualizza Evento</a>
        `;
        await sendEmail(organizerEmail, subject, htmlContent);

        res.status(200).json({ message: 'Evento approvato con successo', event: approvedEvent });
    } catch (error) {
        console.error('Error approving event:', error);
        res.status(500).json({ message: 'Error approving event' });
    }
});

const rejectEvent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE events SET status = $1 WHERE id = $2 RETURNING * ',
            ['rejected', id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }

        const rejectedEvent = result.rows[0];
        const organizer = await pool.query('SELECT email FROM users WHERE id = $1', [rejectedEvent.organizer_id]);
        const organizerEmail = organizer.rows[0].email;

        const subject = 'Il tuo evento è stato rifiutato';
        const htmlContent = `
            <h1>Evento Rifiutato</h1>
            <p>Siamo spiacenti, il tuo evento, <strong>${rejectedEvent.title}</strong>, è stato rifiutato.</p>
            <p>Per maggiori informazioni, contatta l'amministrazione.</p>
        `;
        await sendEmail(organizerEmail, subject, htmlContent);

        res.status(200).json({ message: 'Evento rifiutato con successo', event: rejectedEvent });
    } catch (error) {
        console.error('Error rejecting event:', error);
        res.status(500).json({ message: 'Error rejecting event' });
    }
});

const getAllEvents = asyncHandler(async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT e.*, u.name as organizer_name FROM events e JOIN users u ON e.organizer_id = u.id WHERE e.status = $1 ORDER BY e.event_date DESC',
            ['approved']
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error fetching events' });
    }
});

const getMyCreatedEvents = asyncHandler(async (req, res) => {
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
});

const searchEvents = asyncHandler(async (req, res) => {
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
});

const registerForEvent = asyncHandler(async (req, res) => {
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
});

const unregisterFromEvent = asyncHandler(async (req, res) => {
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
});

const getMyRegisteredEvents = asyncHandler(async (req, res) => {
    const user_id = req.user.id; // Assumendo che l'ID utente sia disponibile in req.user.id
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
});

const getEventById = asyncHandler(async (req, res) => {
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
});

const updateEvent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, event_date, event_time, capacity, image_url_existing, pdf_url_existing, address, location, category } = req.body;
    let finalImageUrl = image_url_existing;
    let finalPdfUrl = pdf_url_existing;

    try {
        // Verifica che l'utente sia l'organizzatore dell'evento
        const eventResult = await pool.query('SELECT organizer_id FROM events WHERE id = $1', [id]);
        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }
        const event = eventResult.rows[0];
        if (event.organizer_id !== req.user.id) {
            return res.status(403).json({ message: 'Non autorizzato a modificare questo evento' });
        }

        // Gestisci upload immagine nuova
        if (req.files && req.files.image_file && req.files.image_file[0]) {
            finalImageUrl = '/uploads/' + req.files.image_file[0].filename;
        }

        // Gestisci upload PDF nuovo
        if (req.files && req.files.pdf_file && req.files.pdf_file[0]) {
            finalPdfUrl = '/uploads/' + req.files.pdf_file[0].filename;
        }

        // Validazioni URL immagine e PDF
        if (finalImageUrl && finalImageUrl.length > 2000) {
            return res.status(400).json({ message: 'Image URL is too long. Maximum 2000 characters allowed.' });
        }
        if (finalPdfUrl && finalPdfUrl.length > 2000) {
            return res.status(400).json({ message: 'PDF URL is too long. Maximum 2000 characters allowed.' });
        }
        if (!finalImageUrl) {
            return res.status(400).json({ message: 'Image URL is required' });
        }


        // Aggiorna evento con stato pending
        const result = await pool.query(
            'UPDATE events SET title = $1, description = $2, event_date = $3, event_time = $4, capacity = $5, image_url = $6, pdf_url = $7, address = $8, location = $9, category = $10, status = $11 WHERE id = $12 RETURNING *',
            [title, description, event_date, event_time, capacity, finalImageUrl, finalPdfUrl, address, location, category, 'pending', id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }
        const updatedEvent = result.rows[0];

        // Invia notifica agli admin per riapprovazione
        const admins = await pool.query('SELECT email FROM users WHERE role = $1', ['admin']);
        const adminEmails = admins.rows.map(admin => admin.email);
        if (adminEmails.length > 0) {
            const adminSubject = 'Evento Modificato - Richiede Riapprovazione';
            const adminHtmlContent = `
                <h1>Evento Modificato</h1>
                <p>L'evento <strong>${updatedEvent.title}</strong> è stato modificato ed è in attesa della tua riapprovazione.</p>
                <p>Descrizione: ${updatedEvent.description}</p>
                <p>Data: ${updatedEvent.event_date} ${updatedEvent.event_time}</p>
                <p>Organizzatore: ${req.user.name || req.user.email}</p>
                <p>Per approvare o rifiutare l'evento, visita la pagina di amministrazione.</p>
                <a href="http://localhost:3000/admin-page.html">Vai alla pagina Admin</a>
            `;
            await sendEmail(adminEmails.join(','), adminSubject, adminHtmlContent);
        }

        res.status(200).json({ message: 'Evento aggiornato con successo - in attesa di riapprovazione', event: updatedEvent });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

const deleteEvent = asyncHandler(async (req, res) => {
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

        // Elimina i messaggi della chat associati all'evento
        await queries.deleteChatMessagesByEventId(id);

        const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato dopo la verifica dell\'autorizzazione' });
        }
        res.status(200).json({ message: 'Evento eliminato con successo' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


const getChatMessages = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    try {
        const messages = await pool.query(
            'SELECT cm.*, u.name as sender_name FROM chat_messages cm JOIN users u ON cm.sender_id = u.id WHERE event_id = $1 ORDER BY timestamp ASC',
            [eventId]
        );
        res.status(200).json(messages.rows);
    } catch (error) {
        console.error('Errore nel recupero dei messaggi della chat:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

const reportEvent = asyncHandler(async (req, res) => {
    const { event_id, report_reason } = req.body;
    const user_id = req.user.id;

    if (!event_id || !report_reason) {
        return res.status(400).json({ message: 'ID evento e motivo della segnalazione sono obbligatori.' });
    }

    try {
        // Inserimento della segnalazione nel database (tabella da creare successivamente)
        await pool.query(
            'INSERT INTO event_reports (event_id, user_id, report_reason, reported_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
            [event_id, user_id, report_reason]
        );

        res.status(201).json({ message: 'Segnalazione inviata con successo.' });
    } catch (error) {
        console.error('Errore durante l\'invio della segnalazione:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

module.exports = {
    createEvent,
    getAllEvents,
    searchEvents,
    registerForEvent,
    unregisterFromEvent,
    getMyRegisteredEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    getPendingEvents,
    approveEvent,
    rejectEvent,
    getMyCreatedEvents,
    getChatMessages,
    reportEvent // Nuova funzione esportata
};