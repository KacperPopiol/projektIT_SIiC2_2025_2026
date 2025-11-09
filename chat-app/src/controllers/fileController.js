const db = require('../models')
const fs = require('fs')
const path = require('path')
const { Op } = require('sequelize')
const { getMimeCategory, UPLOAD_DIR, THUMBNAIL_DIR } = require('../middleware/upload')
const { generateThumbnail } = require('../utils/thumbnailGenerator')

/**
 * Upload plików do konwersacji
 * Pliki są już zaszyfrowane po stronie frontendu przed wysłaniem
 */
exports.uploadFiles = async (req, res) => {
	try {
		const { conversationId } = req.body
		const userId = req.user.userId

		if (!conversationId) {
			return res.status(400).json({
				error: 'Brak conversationId',
			})
		}

		if (!req.files || req.files.length === 0) {
			return res.status(400).json({
				error: 'Brak plików do przesłania',
			})
		}

		// Sprawdź dostęp do konwersacji
		const conversation = await db.Conversation.findByPk(conversationId)

		if (!conversation) {
			return res.status(404).json({
				error: 'Konwersacja nie znaleziona',
			})
		}

		// Sprawdź dostęp dla konwersacji prywatnej
		if (conversation.conversation_type === 'private') {
			const participant = await db.ConversationParticipant.findOne({
				where: {
					conversation_id: conversationId,
					user_id: userId,
				},
			})

			if (!participant) {
				return res.status(403).json({
					error: 'Nie masz dostępu do tej konwersacji',
				})
			}
		}

		// Sprawdź dostęp dla konwersacji grupowej
		if (conversation.conversation_type === 'group') {
			const member = await db.GroupMember.findOne({
				where: {
					group_id: conversation.group_id,
					user_id: userId,
					status: 'accepted',
				},
			})

			if (!member) {
				return res.status(403).json({
					error: 'Nie jesteś członkiem tej grupy',
				})
			}
		}

		// Przetwórz każdy plik
		const uploadedFiles = []

		for (const file of req.files) {
			try {
				const mimeCategory = getMimeCategory(file.mimetype)
				const filePath = file.path

				// Generuj miniaturę dla obrazów
				let thumbnailPath = null
				if (mimeCategory === 'image') {
					thumbnailPath = await generateThumbnail(filePath, file.mimetype, file.originalname)
				}

				// Zapisz informacje o pliku w bazie (bez message_id - zostanie dodane później)
				// Na razie zapisz z message_id = null, później zaktualizujemy
				const fileRecord = await db.File.create({
					message_id: null, // Zostanie zaktualizowane po utworzeniu wiadomości
					original_name: file.originalname,
					stored_name: file.filename,
					file_path: filePath,
					file_type: file.mimetype,
					file_size: file.size,
					mime_category: mimeCategory,
					thumbnail_path: thumbnailPath,
					is_encrypted: false, // Pliki są szyfrowane po stronie frontendu przed wysłaniem
				})

				uploadedFiles.push({
					file_id: fileRecord.file_id,
					original_name: fileRecord.original_name,
					file_type: fileRecord.file_type,
					file_size: fileRecord.file_size,
					mime_category: fileRecord.mime_category,
					thumbnail_path: fileRecord.thumbnail_path,
				})

				console.log(`✅ Plik zapisany: ${file.originalname} (ID: ${fileRecord.file_id})`)
			} catch (fileError) {
				console.error('❌ Błąd przetwarzania pliku:', fileError)
				// Usuń plik z dysku jeśli był zapisany
				if (fs.existsSync(file.path)) {
					fs.unlinkSync(file.path)
				}
			}
		}

		if (uploadedFiles.length === 0) {
			return res.status(500).json({
				error: 'Nie udało się zapisać żadnego pliku',
			})
		}

		res.json({
			success: true,
			files: uploadedFiles,
			message: `Przesłano ${uploadedFiles.length} plik(ów)`,
		})
	} catch (error) {
		console.error('❌ Błąd uploadu plików:', error)

		// Usuń przesłane pliki z dysku w przypadku błędu
		if (req.files) {
			for (const file of req.files) {
				if (fs.existsSync(file.path)) {
					fs.unlinkSync(file.path)
				}
			}
		}

		res.status(500).json({
			error: 'Błąd serwera podczas przesyłania plików',
		})
	}
}

/**
 * Pobieranie pliku
 */
exports.getFile = async (req, res) => {
	try {
		const { fileId } = req.params
		const userId = req.user.userId

		// Pobierz informacje o pliku
		const file = await db.File.findByPk(fileId, {
			include: [
				{
					model: db.Message,
					as: 'message',
					attributes: ['message_id', 'conversation_id', 'sender_id'],
					include: [
						{
							model: db.Conversation,
							as: 'conversation',
							attributes: ['conversation_id', 'conversation_type', 'group_id'],
						},
					],
				},
			],
		})

		if (!file || !file.message) {
			return res.status(404).json({
				error: 'Plik nie znaleziony',
			})
		}

		const conversation = file.message.conversation

		// Sprawdź dostęp do konwersacji
		if (conversation.conversation_type === 'private') {
			const participant = await db.ConversationParticipant.findOne({
				where: {
					conversation_id: conversation.conversation_id,
					user_id: userId,
				},
			})

			if (!participant) {
				return res.status(403).json({
					error: 'Nie masz dostępu do tego pliku',
				})
			}
		} else if (conversation.conversation_type === 'group') {
			const member = await db.GroupMember.findOne({
				where: {
					group_id: conversation.group_id,
					user_id: userId,
					status: 'accepted',
				},
			})

			if (!member) {
				return res.status(403).json({
					error: 'Nie masz dostępu do tego pliku',
				})
			}
		}

		// Sprawdź czy plik istnieje na dysku
		if (!fs.existsSync(file.file_path)) {
			return res.status(404).json({
				error: 'Plik nie został znaleziony na serwerze',
			})
		}

		// Ustaw nagłówki odpowiedzi
		res.setHeader('Content-Type', file.file_type)
		res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`)
		res.setHeader('Content-Length', file.file_size)

		// Wyślij plik
		const fileStream = fs.createReadStream(file.file_path)
		fileStream.pipe(res)
	} catch (error) {
		console.error('❌ Błąd pobierania pliku:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania pliku',
		})
	}
}

/**
 * Pobieranie miniatur
 */
exports.getFileThumbnail = async (req, res) => {
	try {
		const { fileId } = req.params
		const userId = req.user.userId

		// Pobierz informacje o pliku
		const file = await db.File.findByPk(fileId, {
			include: [
				{
					model: db.Message,
					as: 'message',
					attributes: ['message_id', 'conversation_id', 'sender_id'],
					include: [
						{
							model: db.Conversation,
							as: 'conversation',
							attributes: ['conversation_id', 'conversation_type', 'group_id'],
						},
					],
				},
			],
		})

		if (!file || !file.message) {
			return res.status(404).json({
				error: 'Plik nie znaleziony',
			})
		}

		// Sprawdź dostęp (podobnie jak w getFile)
		const conversation = file.message.conversation

		if (conversation.conversation_type === 'private') {
			const participant = await db.ConversationParticipant.findOne({
				where: {
					conversation_id: conversation.conversation_id,
					user_id: userId,
				},
			})

			if (!participant) {
				return res.status(403).json({
					error: 'Nie masz dostępu do tego pliku',
				})
			}
		} else if (conversation.conversation_type === 'group') {
			const member = await db.GroupMember.findOne({
				where: {
					group_id: conversation.group_id,
					user_id: userId,
					status: 'accepted',
				},
			})

			if (!member) {
				return res.status(403).json({
					error: 'Nie masz dostępu do tego pliku',
				})
			}
		}

		// Sprawdź czy miniatura istnieje
		if (!file.thumbnail_path || !fs.existsSync(file.thumbnail_path)) {
			// Jeśli nie ma miniatury, zwróć oryginalny plik (jeśli to obraz)
			if (file.mime_category === 'image' && fs.existsSync(file.file_path)) {
				res.setHeader('Content-Type', file.file_type)
				const fileStream = fs.createReadStream(file.file_path)
				fileStream.pipe(res)
				return
			}

			return res.status(404).json({
				error: 'Miniatura nie dostępna',
			})
		}

		// Wyślij miniaturę
		res.setHeader('Content-Type', 'image/jpeg') // Miniatury są zawsze JPEG
		const thumbnailStream = fs.createReadStream(file.thumbnail_path)
		thumbnailStream.pipe(res)
	} catch (error) {
		console.error('❌ Błąd pobierania miniatury:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania miniatury',
		})
	}
}

/**
 * Usuwanie pliku (używane przez scheduler lub manual)
 */
exports.deleteFile = async (req, res) => {
	try {
		const { fileId } = req.params

		const file = await db.File.findByPk(fileId)

		if (!file) {
			return res.status(404).json({
				error: 'Plik nie znaleziony',
			})
		}

		// Usuń plik z dysku
		if (fs.existsSync(file.file_path)) {
			fs.unlinkSync(file.file_path)
		}

		// Usuń miniaturę jeśli istnieje
		if (file.thumbnail_path && fs.existsSync(file.thumbnail_path)) {
			fs.unlinkSync(file.thumbnail_path)
		}

		// Usuń z bazy danych
		await file.destroy()

		res.json({
			success: true,
			message: 'Plik usunięty',
		})
	} catch (error) {
		console.error('❌ Błąd usuwania pliku:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas usuwania pliku',
		})
	}
}

/**
 * Aktualizuje message_id dla plików (wywoływane po utworzeniu wiadomości)
 */
exports.updateFilesMessageId = async (fileIds, messageId) => {
	try {
		await db.File.update(
			{ message_id: messageId },
			{
				where: {
					file_id: {
						[Op.in]: fileIds,
					},
				},
			}
		)
	} catch (error) {
		console.error('❌ Błąd aktualizacji message_id dla plików:', error)
		throw error
	}
}

