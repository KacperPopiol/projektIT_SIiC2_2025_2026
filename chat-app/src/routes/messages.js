const express = require('express')
const router = express.Router()
const messageController = require('../controllers/messageController')
const { authenticateToken } = require('../middleware/auth')

// Wszystkie trasy wymagają autentykacji
router.use(authenticateToken)

// Pobieranie listy wszystkich konwersacji
router.get('/conversations', messageController.getConversations)

// Dostępne motywy
router.get('/themes', messageController.getAvailableThemes)

// Pobieranie wiadomości z konwersacji
router.get('/conversations/:conversationId', messageController.getMessages)

// Eksport konwersacji do JSON
router.get('/conversations/:conversationId/export', messageController.exportConversation)

// Archiwizacja konwersacji
router.post('/conversations/:conversationId/archive', messageController.archiveConversation)
router.post('/conversations/:conversationId/unarchive', messageController.unarchiveConversation)

// Usuwanie konwersacji (po stronie użytkownika)
router.delete('/conversations/:conversationId', messageController.deleteChat)

// Usuwanie pojedynczej wiadomości
router.delete('/:messageId', messageController.deleteMessage)

// Znikające wiadomości
router.put('/conversations/:conversationId/disappearing', messageController.toggleDisappearingMessages)
router.get('/conversations/:conversationId/settings', messageController.getConversationSettings)
router.put('/conversations/:conversationId/theme', messageController.setConversationTheme)

module.exports = router
