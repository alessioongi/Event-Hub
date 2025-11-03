const express = require('express');
const router = express.Router();
const { createEvent, getAllEvents, searchEvents, registerForEvent, unregisterFromEvent, getMyRegisteredEvents, getEventById, updateEvent, deleteEvent, getPendingEvents, approveEvent, rejectEvent, getMyCreatedEvents, getChatMessages } = require('../controllers/event.controller');
const queries = require('../db/queries');
const upload = require('../middleware/upload');
const { authorize, protect } = require('../middleware/auth.middleware');

// Rotte pubbliche
router.get('/events', getAllEvents);
router.get('/events/my-registrations', protect, getMyRegisteredEvents);
router.get('/events/my-created', protect, getMyCreatedEvents);
router.get('/events/search', searchEvents);
router.get('/events/pending', protect, authorize('admin'), getPendingEvents);

// Rotta per la creazione di eventi
router.post('/events', protect, authorize(), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), createEvent);

router.get('/events/:id', getEventById);
router.get('/chat/messages/:eventId', protect, async (req, res) => {
    try {
        const { eventId } = req.params;
        const messages = await queries.getChatMessagesByEventId(eventId);
        res.json(messages);
    } catch (error) {
        console.error('Errore nel recupero dei messaggi della chat:', error);
        res.status(500).json({ message: 'Errore interno del server' });
    }
});
router.put('/events/:id', protect, upload.fields([{ name: 'image_file', maxCount: 1 }, { name: 'pdf_file', maxCount: 1 }]), updateEvent);
router.put('/events/:id/approve', protect, authorize('admin'), approveEvent);
router.put('/events/:id/reject', protect, authorize('admin'), rejectEvent);
router.delete('/events/:id', protect, deleteEvent);

// Rotte per la registrazione agli eventi
router.post('/events/register', protect, registerForEvent);
router.post('/events/unregister', protect, unregisterFromEvent);

router.get('/:id/chat-messages', protect, getChatMessages);

module.exports = router;