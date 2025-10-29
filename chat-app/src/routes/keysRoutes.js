const express = require('express')
const router = express.Router()
const keysController = require('../controllers/keysController')
const { authenticateToken } = require('../middleware/auth')

router.use(authenticateToken)

router.post('/ecdh', keysController.saveECDHKeys)
router.get('/ecdh/public/:userId', keysController.getPublicKeyDH)
router.get('/ecdh/private-backup', keysController.getEncryptedPrivateKeyDH)
router.get('/conversation/:conversationId/public-keys', keysController.getConversationPublicKeys)
router.get('/group/:groupId/public-keys', keysController.getGroupPublicKeys)
router.post('/group/save', keysController.saveGroupKey)
router.get('/group/:groupId', keysController.getGroupKey)

module.exports = router
