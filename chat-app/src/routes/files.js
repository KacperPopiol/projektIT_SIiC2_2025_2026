const express = require('express')
const router = express.Router()
const fileController = require('../controllers/fileController')
const { authenticateToken } = require('../middleware/auth')
const { uploadFiles } = require('../middleware/upload')

// Wszystkie trasy wymagają autentykacji
router.use(authenticateToken)

// Upload plików
router.post('/upload', uploadFiles, fileController.uploadFiles)

// Pobieranie pliku
router.get('/:fileId', fileController.getFile)

// Pobieranie miniatury
router.get('/:fileId/thumbnail', fileController.getFileThumbnail)

// Usuwanie pliku (manual)
router.delete('/:fileId', fileController.deleteFile)

module.exports = router

