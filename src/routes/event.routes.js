const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const upload = require('../middleware/upload');
const { authorize, protect } = require('../middleware/auth.middleware');

// Rotte pubbliche
router.get('/events', eventController.getAllEvents);
router.get('/events/my-registrations', protect, eventController.getMyRegisteredEvents);
router.get('/events/my-created', protect, eventController.getMyCreatedEvents);
router.get('/events/search', eventController.searchEvents);
router.get('/events/pending', protect, authorize('admin'), eventController.getPendingEvents);
router.get('/events/:id', eventController.getEventById);

// Rotte protette (richiedono autenticazione)
router.post('/events', protect, authorize(), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf_file', maxCount: 1 }]), eventController.createEvent);
router.put('/events/:id', protect, authorize(), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf_file', maxCount: 1 }]), eventController.updateEvent);
router.delete('/events/:id', protect, eventController.deleteEvent);

// Rotte per l'approvazione/rifiuto degli eventi (solo admin)
router.get('/events/pending', protect, authorize('admin'), eventController.getPendingEvents);
router.put('/events/:id/approve', protect, authorize('admin'), eventController.approveEvent);
router.put('/events/:id/reject', protect, authorize('admin'), eventController.rejectEvent);

// Rotte per la registrazione agli eventi
router.post('/events/register', protect, authorize(), eventController.registerForEvent);
router.post('/events/unregister', protect, authorize(), eventController.unregisterFromEvent);

module.exports = router;