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

// Rotta per la creazione di eventi
router.post('/events', protect, authorize(), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), eventController.createEvent);

router.get('/events/:id', eventController.getEventById);
router.put('/events/:id', protect, authorize(), upload.fields([{ name: 'image_file', maxCount: 1 }, { name: 'pdf_file', maxCount: 1 }]), eventController.updateEvent);
router.put('/events/:id/approve', protect, authorize('admin'), eventController.approveEvent);
router.put('/events/:id/reject', protect, authorize('admin'), eventController.rejectEvent);
router.delete('/events/:id', protect, authorize(), eventController.deleteEvent);

// Rotte per la registrazione agli eventi
router.post('/events/register', protect, authorize(), eventController.registerForEvent);
router.post('/events/unregister', protect, authorize(), eventController.unregisterFromEvent);

// Rotte pubbliche
router.get('/events', eventController.getAllEvents);
router.get('/events/my-registrations', protect, eventController.getMyRegisteredEvents);
router.get('/events/my-created', protect, eventController.getMyCreatedEvents);
router.get('/events/search', eventController.searchEvents);
router.get('/events/pending', protect, authorize('admin'), eventController.getPendingEvents);

// Rotta per la creazione di eventi
router.post('/events', protect, authorize(), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), eventController.createEvent);

router.get('/events/:id', eventController.getEventById);
router.put('/events/:id', protect, authorize(), upload.fields([{ name: 'image_file', maxCount: 1 }, { name: 'pdf_file', maxCount: 1 }]), eventController.updateEvent);
router.put('/events/:id/approve', protect, authorize('admin'), eventController.approveEvent);
router.put('/events/:id/reject', protect, authorize('admin'), eventController.rejectEvent);
router.delete('/events/:id', protect, authorize(), eventController.deleteEvent);

// Rotte per la registrazione agli eventi
router.post('/events/register', protect, authorize(), eventController.registerForEvent);
router.post('/events/unregister', protect, authorize(), eventController.unregisterFromEvent);

module.exports = router;