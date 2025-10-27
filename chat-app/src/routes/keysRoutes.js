const express = require('express')
const router = express.Router()
const keysController = require('../controllers/keysController')
const { authenticateToken } = require('../middleware/auth')

router.use(authenticateToken)

router.post('/public-key', keysController.savePublicKey)
router.get('/public-key/:userId', keysController.getPublicKey)
router.get('/prekey-bundle/:userId', keysController.getPreKeyBundle)
router.get('/conversation/:conversationId/keys', keysController.getConversationKeys)

module.exports = router
