const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const { validateRegistration, validateLogin } = require('../middleware/validation')
const { authenticateToken } = require('../middleware/auth')

// Publiczne trasy (bez autentykacji)
router.post('/register', validateRegistration, authController.register)
router.post('/login', validateLogin, authController.login)
router.post('/recover', authController.recoverAccount)

// Chronione trasy (wymagają tokenu JWT)
router.get('/profile', authenticateToken, authController.getProfile)
router.put('/avatar', authenticateToken, authController.updateAvatar)
router.delete('/account', authenticateToken, authController.deleteAccount)

module.exports = router
