const express = require('express')
const router = express.Router()
const contactController = require('../controllers/contactController')
const { authenticateToken } = require('../middleware/auth')
const { validateInviteCode } = require('../middleware/validation')

// Wszystkie trasy wymagają autentykacji
router.use(authenticateToken)

// Generowanie kodu zaproszeniowego
router.post('/generate-code', contactController.generateInviteCode)

// Wysyłanie zaproszenia używając kodu
router.post('/invite', validateInviteCode, contactController.sendInvitation)

// Zarządzanie zaproszeniami
router.post('/:contactId/accept', contactController.acceptInvitation)
router.delete('/:contactId/reject', contactController.rejectInvitation)

// Pobieranie list
router.get('/', contactController.getContacts)
router.get('/pending', contactController.getPendingInvitations)
router.get('/sent', contactController.getSentInvitations)

// Wyszukiwanie znajomego
router.get('/search', contactController.searchContact)



router.delete('/:contactId', contactController.deleteContact);


module.exports = router
