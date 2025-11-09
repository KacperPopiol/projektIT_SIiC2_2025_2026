const multer = require('multer')
const path = require('path')
const fs = require('fs')

// Konfiguracja folderów
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, 'thumbnails')

// Utwórz foldery jeśli nie istnieją
if (!fs.existsSync(UPLOAD_DIR)) {
	fs.mkdirSync(UPLOAD_DIR, { recursive: true })
	console.log(`✅ Utworzono folder uploads: ${UPLOAD_DIR}`)
}

if (!fs.existsSync(THUMBNAIL_DIR)) {
	fs.mkdirSync(THUMBNAIL_DIR, { recursive: true })
	console.log(`✅ Utworzono folder thumbnails: ${THUMBNAIL_DIR}`)
}

// Dozwolone typy MIME
const ALLOWED_MIME_TYPES = {
	// Obrazy
	'image/jpeg': 'image',
	'image/jpg': 'image',
	'image/png': 'image',
	'image/gif': 'image',
	'image/webp': 'image',
	// PDF
	'application/pdf': 'pdf',
	// Dokumenty
	'application/msword': 'document', // .doc
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document', // .docx
	'application/vnd.ms-excel': 'document', // .xls
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document', // .xlsx
	'application/vnd.ms-powerpoint': 'document', // .ppt
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document', // .pptx
	// Wideo
	'video/mp4': 'video',
	'video/webm': 'video',
	'video/x-msvideo': 'video', // .avi
	// Audio
	'audio/mpeg': 'audio', // .mp3
	'audio/wav': 'audio',
	'audio/ogg': 'audio',
}

// Maksymalny rozmiar pliku (200 MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 200 * 1024 * 1024

// Maksymalna liczba plików
const MAX_FILES = 5

// Konfiguracja storage multer
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, UPLOAD_DIR)
	},
	filename: (req, file, cb) => {
		// Generuj unikalną nazwę pliku: timestamp-randomhash-originalname
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
		const ext = path.extname(file.originalname)
		const nameWithoutExt = path.basename(file.originalname, ext)
		// Sanityzacja nazwy pliku (usuń niebezpieczne znaki)
		const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9._-]/g, '_')
		const filename = `${sanitizedName}-${uniqueSuffix}${ext}`
		cb(null, filename)
	},
})

// Filtrowanie plików
const fileFilter = (req, file, cb) => {
	// Sprawdź typ MIME
	if (!ALLOWED_MIME_TYPES[file.mimetype]) {
		return cb(
			new Error(
				`Nieprawidłowy typ pliku: ${file.mimetype}. Dozwolone typy: obrazy, PDF, dokumenty, wideo, audio.`
			),
			false
		)
	}

	cb(null, true)
}

// Konfiguracja multer
const upload = multer({
	storage: storage,
	limits: {
		fileSize: MAX_FILE_SIZE,
		files: MAX_FILES, // Maksymalna liczba plików
	},
	fileFilter: fileFilter,
})

/**
 * Middleware do uploadu wielu plików
 * Maksymalnie 5 plików, każdy max 200 MB
 */
const uploadFiles = upload.array('files', MAX_FILES)

/**
 * Funkcja pomocnicza do określenia kategorii MIME
 */
const getMimeCategory = mimeType => {
	return ALLOWED_MIME_TYPES[mimeType] || 'document'
}

module.exports = {
	uploadFiles,
	getMimeCategory,
	UPLOAD_DIR,
	THUMBNAIL_DIR,
	ALLOWED_MIME_TYPES,
	MAX_FILE_SIZE,
	MAX_FILES,
}

