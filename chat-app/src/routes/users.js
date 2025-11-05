const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const userController = require('../controllers/userController')

// Wszystkie trasy wymagają autentykacji
router.use(authenticateToken)

// Ustawienia powiadomień
router.get('/notification-settings', userController.getNotificationSettings)
router.put('/notification-settings', userController.updateNotificationSettings)

// Domyślny czas znikania wiadomości
router.get('/default-disappearing-time', userController.getDefaultDisappearingTime)
router.put('/default-disappearing-time', userController.updateDefaultDisappearingTime)

module.exports = router
