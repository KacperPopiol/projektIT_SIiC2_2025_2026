const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')

// Wszystkie trasy wymagają autentykacji
router.use(authenticateToken)

// Możesz dodać dodatkowe trasy związane z użytkownikami tutaj
// Na przykład: zmiana hasła, ustawienia, itp.

module.exports = router
