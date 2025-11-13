const pool = require('../db/config');
const { sendEmail } = require('../utils/emailService');
const queries = require('../db/queries');
const { getChatMessagesByEventId, findLowestAvailableEventId } = queries;
const asyncHandler = require('express-async-handler');
// const { getAllUserEmails } = require('./event.controller'); // Rimuovo l'importazione circolare

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
        const adminTemplateData = {
            eventName: title,
            eventDescription: description,
            eventDate: event_date,
            eventTime: event_time,
            organizerName: req.user.name || req.user.email,
            adminPanelLink: `${process.env.FRONTEND_URL}/admin-approve-events.html`,
            year: new Date().getFullYear()
        };
        await sendEmail(adminEmails.join(','), adminSubject, null, 'adminNewEventNotification', adminTemplateData);
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

        const eventLink = `${process.env.FRONTEND_URL}/event-details.html?id=${approvedEvent.id}`;

        // Invia email all'organizzatore
        const subject = 'Il tuo evento è stato approvato!';
        const templateData = {
            userName: organizerEmail,
            eventName: approvedEvent.title,
            decision: 'approvato',
            isApproved: true,
            isRejected: false,
            isIgnored: false,
            eventLink: eventLink,
            year: new Date().getFullYear()
        };
        await sendEmail(organizerEmail, subject, null, 'reportDecisionEmail', templateData);

        // Invia notifica a tutti gli utenti
        const allUserEmails = await getAllUserEmails();
        const notificationSubject = `Nuovo Evento Approvato: ${approvedEvent.title}`;
        const notificationTemplateData = {
            eventName: approvedEvent.title,
            eventLink: eventLink,
            eventDate: new Date(approvedEvent.event_date).toLocaleDateString('it-IT'),
            eventLocation: approvedEvent.location,
            year: new Date().getFullYear()
        };

        for (const userEmail of allUserEmails) {
            await sendEmail(userEmail, notificationSubject, null, 'eventApprovedNotification', notificationTemplateData);
        }

        // Verifica se ci sono segnalazioni per questo evento e notifica i segnalatori
        const reportsResult = await pool.query('SELECT user_id FROM event_reports WHERE event_id = $1', [id]);
        for (const report of reportsResult.rows) {
            const reporterEmailResult = await pool.query('SELECT email FROM users WHERE id = $1', [report.user_id]);
            const reporterEmail = reporterEmailResult.rows[0]?.email;
            if (reporterEmail) {
                const reporterSubject = `Aggiornamento sulla tua segnalazione per l'evento: ${approvedEvent.title}`;
                const reporterTemplateData = {
                    userName: reporterEmail,
                    eventName: approvedEvent.title,
                    decision: 'approvato',
                    isApproved: true,
                    isRejected: false,
                    isIgnored: false,
                    year: new Date().getFullYear()
                };
                await sendEmail(reporterEmail, reporterSubject, null, 'newReportEmail', reporterTemplateData);
            }
        }

        // Elimina tutte le segnalazioni relative a questo evento dopo l'approvazione
        await pool.query(
            'DELETE FROM event_reports WHERE event_id = $1',
            [id]
        );

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

        // Invia email all'organizzatore
        const subject = 'Il tuo evento è stato rifiutato!';
        const templateData = {
            userName: organizerEmail,
            eventName: rejectedEvent.title,
            decision: 'rifiutato',
            isApproved: false,
            isRejected: true,
            isIgnored: false,
            isReportRelated: false,
            year: new Date().getFullYear()
        };
        await sendEmail(organizerEmail, subject, null, 'reportDecisionEmail', templateData);

        // Invia notifica a tutti gli utenti per evento rimosso a causa di segnalazione
        const allUserEmails = await getAllUserEmails();
        const eventLink = `${process.env.FRONTEND_URL}/public-page.html`; // Link alla pagina pubblica dove l'evento non sarà più visibile
        const notificationSubjectAllUsers = `Evento Rimosso: ${rejectedEvent.title}`;
        const notificationTemplateDataAllUsers = {
            eventName: rejectedEvent.title,
            eventLink: eventLink,
            eventDate: new Date(rejectedEvent.event_date).toLocaleDateString('it-IT'),
            eventLocation: rejectedEvent.location,
            isRejected: true, // Flag per indicare che l'evento è stato rimosso
            isReportRelated: true, // Flag per indicare che la rimozione è dovuta a segnalazione
            year: new Date().getFullYear()
        };

        for (const userEmail of allUserEmails) {
            console.log(`Invio email di rimozione evento (a tutti gli utenti) a: ${userEmail}`);
            await sendEmail(userEmail, notificationSubjectAllUsers, null, 'eventApprovedNotification', notificationTemplateDataAllUsers);
        }

        // Recupera tutti i segnalatori per questo evento e invia loro un'email
        const reportsResult = await pool.query('SELECT user_id FROM event_reports WHERE event_id = $1', [id]);
        for (const report of reportsResult.rows) {
            const reporterEmailResult = await pool.query('SELECT email FROM users WHERE id = $1', [report.user_id]);
            const reporterEmail = reporterEmailResult.rows[0]?.email;
            if (reporterEmail) {
                const reporterSubject = `Aggiornamento sulla tua segnalazione per l'evento: ${rejectedEvent.title}`;
                const reporterTemplateData = {
                    userName: reporterEmail,
                    eventName: rejectedEvent.title,
                    decision: 'rifiutato',
                    isApproved: false,
                    isRejected: true,
                    isIgnored: false,
                    isReportRelated: true,
                    year: new Date().getFullYear()
                };
                await sendEmail(reporterEmail, reporterSubject, null, 'reportDecisionEmail', reporterTemplateData);
            }
        }

        // Elimina tutte le segnalazioni relative a questo evento dopo il rifiuto
        await pool.query(
            'DELETE FROM event_reports WHERE event_id = $1',
            [id]
        );

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
            const organizerDetails = await pool.query('SELECT name, email FROM users WHERE id = $1', [updatedEvent.organizer_id]);
            const organizerName = organizerDetails.rows[0].name || organizerDetails.rows[0].email;
            const templateData = {
                eventName: updatedEvent.title,
                eventDescription: updatedEvent.description,
                eventDate: updatedEvent.event_date,
                eventTime: updatedEvent.event_time,
                organizerName: organizerName,
                adminPanelLink: `${process.env.FRONTEND_URL}/admin-approve-events.html`,
                year: new Date().getFullYear()
            };
            await sendEmail(adminEmails.join(','), adminSubject, null, 'adminEventModifiedNotification', templateData);
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
        // Recupera l'evento per verificare l'organizzatore e ottenere i dettagli completi
        const eventDetailsResult = await pool.query('SELECT * FROM events WHERE id = $1', [id]);

        if (eventDetailsResult.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }

        const eventToDelete = eventDetailsResult.rows[0];

        // Verifica se l'utente è l'organizzatore o un amministratore
        if (eventToDelete.organizer_id !== user_id && user_role !== 'admin') {
            return res.status(403).json({ message: 'Non autorizzato ad eliminare questo evento' });
        }

        // Elimina i messaggi della chat associati all'evento
        await queries.deleteChatMessagesByEventId(id);

        // Elimina l'evento
        await pool.query('DELETE FROM events WHERE id = $1', [id]);

        // Invia notifica a tutti gli utenti
        const allUserEmails = await getAllUserEmails();
        if (allUserEmails.length > 0) {
            const eventLink = `${process.env.FRONTEND_URL}/event-details.html?id=${id}`;
            const notificationTemplateData = {
                eventName: eventToDelete.title,
                eventDescription: eventToDelete.description,
                eventDate: eventToDelete.event_date,
                eventTime: eventToDelete.event_time,
                eventLink: eventLink,
                isDeleted: true,
                year: new Date().getFullYear()
            };
            const subject = `Aggiornamento Evento: ${eventToDelete.title} è stato eliminato`;
            await sendEmail(allUserEmails.join(','), subject, null, 'eventApprovedNotification', notificationTemplateData);
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

        // Recupera gli indirizzi email degli amministratori
        const adminEmailsResult = await pool.query('SELECT email FROM users WHERE role = $1', ['admin']);
        const adminEmails = adminEmailsResult.rows.map(row => row.email);

        // Recupera i dettagli dell'evento
        const eventDetailsResult = await pool.query('SELECT title, organizer_id FROM events WHERE id = $1', [event_id]);
        const eventTitle = eventDetailsResult.rows[0] ? eventDetailsResult.rows[0].title : 'Evento Sconosciuto';
        const eventCreatorId = eventDetailsResult.rows[0] ? eventDetailsResult.rows[0].organizer_id : null;

        // Recupera l'email del segnalatore
        const reporterEmailResult = await pool.query('SELECT email FROM users WHERE id = $1', [user_id]);
        const reporterEmail = reporterEmailResult.rows[0] ? reporterEmailResult.rows[0].email : null;

        // Recupera l'email del creatore dell'evento
        let eventCreatorEmail = null;
        if (eventCreatorId) {
            const eventCreatorEmailResult = await pool.query('SELECT email FROM users WHERE id = $1', [eventCreatorId]);
            eventCreatorEmail = eventCreatorEmailResult.rows[0] ? eventCreatorEmailResult.rows[0].email : null;
        }

        // Invia email agli amministratori
        if (adminEmails.length > 0) {
            const adminSubject = `Nuova segnalazione di evento: ${eventTitle}`;
            const adminTemplateData = {
                eventName: eventTitle,
                eventId: event_id,
                reportReason: report_reason,
                reporterId: user_id,
                adminPanelLink: `${process.env.FRONTEND_URL}/admin-reported-events.html`,
                year: new Date().getFullYear(),
                isAdminNotification: true,
                message: "È stata inviata una nuova segnalazione per l'evento."
            };
            for (const email of adminEmails) {
                await sendEmail(email, adminSubject, null, 'newReportEmail', adminTemplateData);
            }
        }

        // Invia email al segnalatore
        if (reporterEmail) {
            const reporterSubject = `Grazie per la tua segnalazione dell'evento: ${eventTitle}`;
            const reporterTemplateData = {
                userName: reporterEmail,
                eventName: eventTitle,
                reportReason: report_reason,
                year: new Date().getFullYear(),
                isReporterThankYou: true,
                message: "Abbiamo ricevuto la tua segnalazione e la esamineremo attentamente."
            };
            await sendEmail(reporterEmail, reporterSubject, null, 'newReportEmail', reporterTemplateData);
        }

        // Invia email al creatore dell'evento (se diverso dal segnalatore)
        if (eventCreatorEmail && eventCreatorEmail !== reporterEmail) {
            const creatorSubject = `Il tuo evento '${eventTitle}' è stato segnalato.`;
            const creatorTemplateData = {
                userName: eventCreatorEmail,
                eventName: eventTitle,
                reportReason: report_reason,
                year: new Date().getFullYear(),
                isCreatorNotification: true,
                message: "Il tuo evento ha ricevuto una segnalazione."
            };
            await sendEmail(eventCreatorEmail, creatorSubject, null, 'newReportEmail', creatorTemplateData);
        }

        res.status(201).json({ message: 'Evento segnalato con successo.' });
    } catch (error) {
        console.error('Errore durante l\'invio della segnalazione:', error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

const getReportedEvents = asyncHandler(async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT er.id as report_id, er.report_reason, er.reported_at as report_date, e.id as event_id, e.title as event_name, e.description as event_description, e.event_date, e.event_time, e.location as event_location, u.id as user_id, u.name as reporter_name FROM event_reports er JOIN events e ON er.event_id = e.id JOIN users u ON er.user_id = u.id ORDER BY er.reported_at DESC'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching reported events:', error);
        res.status(500).json({ message: 'Error fetching reported events' });
    }
});

const ignoreReport = asyncHandler(async (req, res) => {
    const { report_id } = req.body;
    try {
        const result = await pool.query(
            'DELETE FROM event_reports WHERE id = $1 RETURNING * ',
            [report_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Segnalazione non trovata' });
        }

        const ignoredReport = result.rows[0];
        const eventId = ignoredReport.event_id;
        const reporterId = ignoredReport.user_id;

        // Recupera i dettagli dell'evento
        const eventResult = await pool.query('SELECT title, organizer_id FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato per la segnalazione ignorata' });
        }
        const eventDetails = eventResult.rows[0];

        // Invia email all'organizzatore (se applicabile, anche se la segnalazione è ignorata, l'organizzatore potrebbe volerlo sapere)
        const organizer = await pool.query('SELECT email FROM users WHERE id = $1', [eventDetails.organizer_id]);
        const organizerEmail = organizer.rows[0]?.email;

        if (organizerEmail) {
            const organizerSubject = `Aggiornamento sulla segnalazione per il tuo evento: ${eventDetails.title}`;
            const organizerTemplateData = {
                userName: organizerEmail,
                eventName: eventDetails.title,
                decision: 'ignorata',
                isApproved: false,
                isRejected: false,
                isIgnored: true,
            isReportRelated: true,
            year: new Date().getFullYear()
            };
            await sendEmail(organizerEmail, organizerSubject, null, 'reportDecisionEmail', organizerTemplateData);
        }

        // Invia email al segnalatore
        const reporterEmailResult = await pool.query('SELECT email FROM users WHERE id = $1', [reporterId]);
        const reporterEmail = reporterEmailResult.rows[0]?.email;

        if (reporterEmail) {
            const reporterSubject = `Aggiornamento sulla tua segnalazione per l'evento: ${eventDetails.title}`;
            const reporterTemplateData = {
                userName: reporterEmail,
                eventName: eventDetails.title,
                decision: 'ignorata',
                isApproved: false,
                isRejected: false,
                isIgnored: true,
                        isReportRelated: true,
                        year: new Date().getFullYear()
            };
            await sendEmail(reporterEmail, reporterSubject, null, 'reportDecisionEmail', reporterTemplateData);
        }

        res.status(200).json({ message: 'Segnalazione ignorata con successo' });
    } catch (error) {
        console.error('Error ignoring report:', error);
        res.status(500).json({ message: 'Error ignoring report' });
    }
});

const rejectReportedEvent = asyncHandler(async (req, res) => {
    const { event_id, report_id } = req.body;
    try {
        // Rifiuta l'evento
        const eventResult = await pool.query(
            'UPDATE events SET status = $1 WHERE id = $2 RETURNING * ',
            ['rejected', event_id]
        );
        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }

        // Elimina tutte le segnalazioni relative a questo evento
        await pool.query(
            'DELETE FROM event_reports WHERE event_id = $1',
            [event_id]
        );

        // Invia notifica all'organizzatore
        const rejectedEvent = eventResult.rows[0];
        const organizer = await pool.query('SELECT email FROM users WHERE id = $1', [rejectedEvent.organizer_id]);
        const organizerEmail = organizer.rows[0].email;

        // Invia email all'organizzatore
        const subject = 'Il tuo evento è stato rifiutato a causa di segnalazioni';
        const templateData = {
            userName: organizerEmail,
            eventName: rejectedEvent.title,
            decision: 'rifiutato',
            isApproved: false,
            isRejected: true,
            isIgnored: false,
            isReportRelated: true,
            year: new Date().getFullYear()
        };
        await sendEmail(organizerEmail, subject, null, 'reportDecisionEmail', templateData);

        // Invia notifica a tutti gli utenti per evento rimosso a causa di segnalazione
        const allUserEmails = await getAllUserEmails();
        const eventLink = `${process.env.FRONTEND_URL}/public-page.html`; // Link alla pagina pubblica dove l'evento non sarà più visibile
        const notificationSubjectAllUsers = `Evento Rimosso: ${rejectedEvent.title}`;
        const notificationTemplateDataAllUsers = {
            eventName: rejectedEvent.title,
            eventLink: eventLink,
            eventDate: new Date(rejectedEvent.event_date).toLocaleDateString('it-IT'),
            eventLocation: rejectedEvent.location,
            isRejected: true, // Flag per indicare che l'evento è stato rimosso
            isReportRelated: true, // Flag per indicare che la rimozione è dovuta a segnalazione
            year: new Date().getFullYear()
        };

        for (const userEmail of allUserEmails) {
            console.log(`Invio email di rimozione evento (a tutti gli utenti) a: ${userEmail}`);
            await sendEmail(userEmail, notificationSubjectAllUsers, null, 'eventApprovedNotification', notificationTemplateDataAllUsers);
        }

        // Recupera tutti i segnalatori per questo evento e invia loro un'email
        const reportersResult = await pool.query('SELECT DISTINCT user_id FROM event_reports WHERE event_id = $1', [event_id]);
        for (const reporter of reportersResult.rows) {
            const reporterEmailResult = await pool.query('SELECT email FROM users WHERE id = $1', [reporter.user_id]);
            const reporterEmail = reporterEmailResult.rows[0]?.email;
            if (reporterEmail) {
                const reporterSubject = `Aggiornamento sulla tua segnalazione per l'evento: ${rejectedEvent.title}`;
                const reporterTemplateData = {
                    userName: reporterEmail,
                    eventName: rejectedEvent.title,
                    decision: 'rifiutato',
                    isApproved: false,
                    isRejected: true,
                    isIgnored: false,
                    isReportRelated: true,
                    year: new Date().getFullYear()
                };
                await sendEmail(reporterEmail, reporterSubject, null, 'reportDecisionEmail', reporterTemplateData);
            }
        }

        res.status(200).json({ message: 'Evento rifiutato e segnalazioni rimosse con successo' });
    } catch (error) {
        console.error('Error rejecting reported event:', error);
        res.status(500).json({ message: 'Error rejecting reported event' });
    }
});

const getAllUserEmails = async () => {
    try {
        const result = await pool.query('SELECT email FROM users');
        console.log("Recuperati indirizzi email utenti:", result.rows.map(row => row.email)); // Aggiunto log
        return result.rows.map(row => row.email);
    } catch (error) {
        console.error('Error fetching all user emails:', error);
        return [];
    }
};

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
    reportEvent,
    getReportedEvents,
    ignoreReport,
    rejectReportedEvent,
    getAllUserEmails
};