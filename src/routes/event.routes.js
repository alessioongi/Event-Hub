const express = require('express');
const router = express.Router();
const { createEvent, getAllEvents, searchEvents, registerForEvent, unregisterFromEvent, getMyRegisteredEvents, getEventById, updateEvent, deleteEvent, getPendingEvents, approveEvent, rejectEvent, getMyCreatedEvents, getChatMessages } = require('../controllers/event.controller');
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
router.put('/events/:id', protect, upload.fields([{ name: 'image_file', maxCount: 1 }, { name: 'pdf_file', maxCount: 1 }]), updateEvent);
router.put('/events/:id/approve', protect, authorize('admin'), approveEvent);
router.put('/events/:id/reject', protect, authorize('admin'), rejectEvent);
router.delete('/events/:id', protect, deleteEvent);

// Rotte per la registrazione agli eventi
router.post('/events/register', protect, registerForEvent);
router.post('/events/unregister', protect, unregisterFromEvent);

router.get('/:id/chat-messages', protect, getChatMessages);

module.exports = router;