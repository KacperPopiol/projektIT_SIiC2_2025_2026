const Jimp = require('jimp')
const path = require('path')
const fs = require('fs')
const { THUMBNAIL_DIR } = require('../middleware/upload')

/**
 * Generuje miniaturę dla obrazu
 * @param {string} imagePath - Ścieżka do oryginalnego obrazu
 * @param {string} originalName - Oryginalna nazwa pliku (dla wygenerowania nazwy miniatury)
 * @returns {Promise<string|null>} - Ścieżka do wygenerowanej miniatury lub null jeśli błąd
 */
const generateImageThumbnail = async (imagePath, originalName) => {
	try {
		// Wczytaj obraz
		const image = await Jimp.read(imagePath)

		// Resize z zachowaniem proporcji – krótszy bok ≤ maxSize
		const maxSize = 300
		const { width, height } = image.bitmap

		if (width > maxSize || height > maxSize) {
			const scale = Math.min(maxSize / width, maxSize / height)
			const newWidth = Math.round(width * scale)
			const newHeight = Math.round(height * scale)
			image.resize(newWidth, newHeight, Jimp.RESIZE_BILINEAR)
		}

		// Wygeneruj nazwę miniatury
		const ext = path.extname(originalName)
		const nameWithoutExt = path.basename(originalName, ext)
		const thumbnailName = `thumb_${nameWithoutExt}_${Date.now()}${ext}`
		const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailName)

		// Zapisz miniaturę
		await image.writeAsync(thumbnailPath)

		console.log(`✅ Wygenerowano miniaturę: ${thumbnailPath}`)
		return thumbnailPath
	} catch (error) {
		console.error('❌ Błąd generowania miniatury obrazu:', error)
		return null
	}
}

/**
 * Określa czy plik wymaga generowania miniatury
 * @param {string} mimeType - Typ MIME pliku
 * @returns {boolean}
 */
const requiresThumbnail = mimeType => {
	const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
	return imageMimeTypes.includes(mimeType)
}

/**
 * Generuje miniaturę dla pliku (tylko obrazy)
 * @param {string} filePath - Ścieżka do pliku
 * @param {string} mimeType - Typ MIME pliku
 * @param {string} originalName - Oryginalna nazwa pliku
 * @returns {Promise<string|null>} - Ścieżka do miniatury lub null
 */
const generateThumbnail = async (filePath, mimeType, originalName) => {
	if (!requiresThumbnail(mimeType)) {
		return null // Tylko obrazy wymagają miniatur
	}

	return await generateImageThumbnail(filePath, originalName)
}

module.exports = {
	generateThumbnail,
	generateImageThumbnail,
	requiresThumbnail,
}

