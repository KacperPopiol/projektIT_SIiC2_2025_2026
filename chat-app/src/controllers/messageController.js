const db = require('../models')
const { Op } = require('sequelize')
const {
	chatThemes,
	chatThemesMap,
	resolveThemeForConversation,
	applyThemeToConversation,
	normalizeThemeKey,
} = require('../utils/conversationTheme')
const { createThemeChangeSystemMessage } = require('../utils/systemMessage')

/**
 * Pobieranie historii wiadomości z konwersacji
 */
exports.getMessages = async (req, res) => {
	try {
		const { conversationId } = req.params
		const userId = req.user.userId
		const { limit = 50, offset = 0 } = req.query

		// Sprawdź czy użytkownik ma dostęp do konwersacji
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

		// Pobierz wiadomości (pomiń te usunięte przez tego użytkownika)
		const deletedMessageIds = await db.DeletedMessage.findAll({
			where: { user_id: userId },
			attributes: ['message_id'],
		})

		const deletedIds = deletedMessageIds.map(dm => dm.message_id)

		const messages = await db.Message.findAll({
			where: {
				conversation_id: conversationId,
				message_id: {
					[Op.notIn]: deletedIds.length > 0 ? deletedIds : [0],
				},
			},
			include: [
				{
					model: db.User,
					as: 'sender',
					attributes: ['user_id', 'username', 'avatar_url'],
				},
				{
					model: db.MessageReadStatus,
					as: 'readStatuses',
					attributes: ['user_id', 'is_read', 'read_at', 'delete_at'],
				},
				{
					model: db.File,
					as: 'files',
					attributes: ['file_id', 'original_name', 'file_type', 'file_size', 'mime_category', 'thumbnail_path'],
				},
			],
			attributes: [
				'message_id',
				'conversation_id',
				'sender_id',
				'content',
				'is_encrypted',
				'message_type',
				'system_payload',
				'created_at',
			],
			order: [['created_at', 'DESC']],
			limit: parseInt(limit),
			offset: parseInt(offset),
		})

		res.json({
			success: true,
			count: messages.length,
			messages: messages.reverse(), // Odwróć żeby najstarsze były pierwsze
		})
	} catch (error) {
		console.error('❌ Błąd pobierania wiadomości:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania wiadomości',
		})
	}
}

/**
 * Lista dostępnych motywów czatu
 */
exports.getAvailableThemes = (req, res) => {
	res.json({
		success: true,
		themes: chatThemes.map(theme => ({
			key: theme.key,
			name: theme.name,
			preview: theme.preview,
			variables: theme.variables,
		})),
	})
}

/**
 * Usunięcie pojedynczej wiadomości (po stronie użytkownika)
 */
exports.deleteMessage = async (req, res) => {
	try {
		const { messageId } = req.params
		const userId = req.user.userId

		const message = await db.Message.findByPk(messageId)

		if (!message) {
			return res.status(404).json({
				error: 'Wiadomość nie znaleziona',
			})
		}

		if (message.message_type === 'system') {
			return res.status(400).json({
				error: 'Wiadomości systemowe nie mogą być usunięte',
			})
		}

		// Sprawdź czy już usunięta
		const alreadyDeleted = await db.DeletedMessage.findOne({
			where: {
				message_id: messageId,
				user_id: userId,
			},
		})

		if (alreadyDeleted) {
			return res.status(400).json({
				error: 'Wiadomość już usunięta',
			})
		}

		// Dodaj do tabeli usuniętych wiadomości
		await db.DeletedMessage.create({
			message_id: messageId,
			user_id: userId,
		})

		// Usuń powiązane pliki z dysku (jeśli są)
		const files = await db.File.findAll({
			where: { message_id: messageId },
		})

		const fs = require('fs')
		for (const file of files) {
			try {
				// Usuń plik z dysku
				if (fs.existsSync(file.file_path)) {
					fs.unlinkSync(file.file_path)
				}
				// Usuń miniaturę jeśli istnieje
				if (file.thumbnail_path && fs.existsSync(file.thumbnail_path)) {
					fs.unlinkSync(file.thumbnail_path)
				}
				// Usuń z bazy
				await file.destroy()
			} catch (error) {
				console.error(`❌ Błąd usuwania pliku ${file.file_id}:`, error)
			}
		}

		// Emit socket event w czasie rzeczywistym (jeśli io dostępne)
		const io = req.app.get('io')
		if (io) {
			io.to(`user:${userId}`).emit('message_disappeared', {
				messageId: messageId,
				userId: userId,
			})
		}

		res.json({
			success: true,
			message: 'Wiadomość usunięta po Twojej stronie',
		})
	} catch (error) {
		console.error('❌ Błąd usuwania wiadomości:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas usuwania wiadomości',
		})
	}
}

/**
 * Archiwizacja konwersacji prywatnej
 */
exports.archiveConversation = async (req, res) => {
	try {
		const { conversationId } = req.params
		const userId = req.user.userId

		const participant = await db.ConversationParticipant.findOne({
			where: {
				conversation_id: conversationId,
				user_id: userId,
			},
		})

		if (!participant) {
			return res.status(404).json({
				error: 'Konwersacja nie znaleziona',
			})
		}

		await participant.update({
			is_archived: true,
			archived_at: new Date(),
		})

		res.json({
			success: true,
			message: 'Konwersacja zarchiwizowana',
		})
	} catch (error) {
		console.error('❌ Błąd archiwizacji konwersacji:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas archiwizacji',
		})
	}
}

/**
 * Przywrócenie konwersacji z archiwum
 */
exports.unarchiveConversation = async (req, res) => {
	try {
		const { conversationId } = req.params
		const userId = req.user.userId

		const participant = await db.ConversationParticipant.findOne({
			where: {
				conversation_id: conversationId,
				user_id: userId,
			},
		})

		if (!participant) {
			return res.status(404).json({
				error: 'Konwersacja nie znaleziona',
			})
		}

		await participant.update({
			is_archived: false,
			archived_at: null,
		})

		res.json({
			success: true,
			message: 'Konwersacja przywrócona z archiwum',
		})
	} catch (error) {
		console.error('❌ Błąd przywracania konwersacji:', error)
		res.status(500).json({
			error: 'Błąd serwera',
		})
	}
}

/**
 * Usunięcie całego chatu po swojej stronie
 */
exports.deleteChat = async (req, res) => {
	try {
		const { conversationId } = req.params
		const userId = req.user.userId

		// Pobierz wszystkie wiadomości z konwersacji
		const messages = await db.Message.findAll({
			where: { conversation_id: conversationId },
			attributes: ['message_id', 'message_type'],
		})

		const messagesToDelete = messages.filter(msg => msg.message_type !== 'system')

		if (messagesToDelete.length === 0) {
			return res.json({
				success: true,
				message: 'Brak wiadomości do usunięcia',
			})
		}

		// Dodaj wszystkie wiadomości do tabeli usuniętych
		const deletions = messagesToDelete.map(msg => ({
			message_id: msg.message_id,
			user_id: userId,
		}))

		await db.DeletedMessage.bulkCreate(deletions, {
			ignoreDuplicates: true,
		})

		res.json({
			success: true,
			message: 'Cała konwersacja usunięta po Twojej stronie',
		})
	} catch (error) {
		console.error('❌ Błąd usuwania chatu:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas usuwania chatu',
		})
	}
}

/**
 * Pobieranie listy konwersacji użytkownika
 */
exports.getConversations = async (req, res) => {
	try {
		const userId = req.user.userId
		const { includeArchived = false } = req.query

		// Pobierz konwersacje prywatne
		const whereClause = {
			user_id: userId,
		}

		if (includeArchived === 'false') {
			whereClause.is_archived = false
		}

		const privateConversations = await db.ConversationParticipant.findAll({
			where: whereClause,
			include: [
				{
					model: db.Conversation,
					as: 'conversation',
					where: { conversation_type: 'private' },
					include: [
						{
							model: db.ConversationParticipant,
							as: 'participants',
							where: {
								user_id: { [Op.ne]: userId },
							},
							include: [
								{
									model: db.User,
									as: 'user',
									attributes: ['user_id', 'username', 'avatar_url'],
								},
							],
						},
						{
							model: db.Message,
							as: 'messages',
							limit: 1,
							order: [['created_at', 'DESC']],
							attributes: [
								'message_id',
								'sender_id',
								'content',
								'is_encrypted',
								'message_type',
								'system_payload',
								'created_at',
							],
							include: [
								{
									model: db.User,
									as: 'sender',
									attributes: ['username'],
								},
							],
						},
					],
				},
			],
		})

		// Pobierz konwersacje grupowe
		const groupConversations = await db.GroupMember.findAll({
			where: {
				user_id: userId,
				status: 'accepted',
			},
			include: [
				{
					model: db.Group,
					as: 'group',
					include: [
						{
							model: db.Conversation,
							as: 'conversation',
							include: [
								{
									model: db.Message,
									as: 'messages',
									limit: 1,
									order: [['created_at', 'DESC']],
									attributes: [
										'message_id',
										'sender_id',
										'content',
										'is_encrypted',
										'message_type',
										'system_payload',
										'created_at',
									],
									include: [
										{
											model: db.User,
											as: 'sender',
											attributes: ['username'],
										},
									],
								},
							],
						},
					],
				},
			],
		})

		res.json({
			success: true,
			privateConversations,
			groupConversations,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania konwersacji:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania konwersacji',
		})
	}
}

/**
 * Eksport konwersacji do JSON
 */
exports.exportConversation = async (req, res) => {
	try {
		const { conversationId } = req.params
		const userId = req.user.userId

		// Sprawdź dostęp
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

		// Pobierz wszystkie wiadomości
		const messages = await db.Message.findAll({
			where: { conversation_id: conversationId },
			include: [
				{
					model: db.User,
					as: 'sender',
					attributes: ['username'],
				},
			],
			order: [['created_at', 'ASC']],
		})

		const exportData = {
			conversationId,
			exportDate: new Date(),
			messages: messages.map(msg => ({
				sender: msg.sender.username,
				content: msg.content,
				sentAt: msg.created_at,
			})),
		}

		res.json({
			success: true,
			data: exportData,
		})
	} catch (error) {
		console.error('❌ Błąd eksportu konwersacji:', error)
		res.status(500).json({
			error: 'Błąd serwera',
		})
	}
}

/**
 * Przełączanie trybu znikających wiadomości dla konwersacji
 */
exports.toggleDisappearingMessages = async (req, res) => {
	try {
		const { conversationId } = req.params
		const { enabled } = req.body
		const userId = req.user.userId

		// Sprawdź czy konwersacja istnieje
		const conversation = await db.Conversation.findByPk(conversationId)

		if (!conversation) {
			return res.status(404).json({
				error: 'Konwersacja nie znaleziona',
			})
		}

		// Sprawdź dostęp użytkownika do konwersacji
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
					error: 'Nie jesteś członkiem tej grupy',
				})
			}
		}

		// Aktualizuj ustawienia konwersacji
		const updateData = {
			disappearing_messages_enabled: enabled,
		}

		if (enabled) {
			updateData.disappearing_messages_enabled_at = new Date()
			updateData.disappearing_messages_enabled_by = userId
		} else {
			updateData.disappearing_messages_enabled_at = null
			updateData.disappearing_messages_enabled_by = null
		}

		await conversation.update(updateData)

		let disappearingTime = null
		if (conversation.disappearing_messages_enabled && conversation.disappearing_messages_enabled_by) {
			const enabledByUser = await db.User.findByPk(conversation.disappearing_messages_enabled_by, {
				attributes: ['default_disappearing_time'],
			})

			if (enabledByUser && typeof enabledByUser.default_disappearing_time === 'number') {
				disappearingTime = enabledByUser.default_disappearing_time
			}
		}

		res.json({
			success: true,
			message: enabled ? 'Tryb znikających wiadomości włączony' : 'Tryb znikających wiadomości wyłączony',
			settings: {
				disappearing_messages_enabled: conversation.disappearing_messages_enabled,
				disappearing_messages_enabled_at: conversation.disappearing_messages_enabled_at,
				disappearing_messages_enabled_by: conversation.disappearing_messages_enabled_by,
				disappearing_time: disappearingTime,
			},
		})
	} catch (error) {
		console.error('❌ Błąd przełączania trybu znikających wiadomości:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas przełączania trybu',
		})
	}
}

/**
 * Ustawienie motywu konwersacji
 */
exports.setConversationTheme = async (req, res) => {
	try {
		const { conversationId } = req.params
		const { themeKey } = req.body
		const userId = req.user.userId

		if (!themeKey || typeof themeKey !== 'string') {
			return res.status(400).json({
				error: 'Brak lub nieprawidłowy identyfikator motywu',
			})
		}

		const normalizedThemeKey = normalizeThemeKey(themeKey)
		const themeDefinition = chatThemesMap[normalizedThemeKey]

		if (!themeDefinition) {
			return res.status(400).json({
				error: 'Wybrany motyw nie istnieje',
			})
		}

		const conversation = await db.Conversation.findByPk(conversationId)

		if (!conversation) {
			return res.status(404).json({
				error: 'Konwersacja nie znaleziona',
			})
		}

		// Sprawdź dostęp użytkownika do konwersacji
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
					error: 'Nie jesteś członkiem tej grupy',
				})
			}
		}

		let participantIds = []

		if (conversation.conversation_type === 'private') {
			const participants = await db.ConversationParticipant.findAll({
				where: { conversation_id: conversationId },
				attributes: ['user_id'],
			})
			participantIds = participants.map(p => p.user_id)
		} else {
			const members = await db.GroupMember.findAll({
				where: {
					group_id: conversation.group_id,
					status: 'accepted',
				},
				attributes: ['user_id'],
			})
			participantIds = members.map(m => m.user_id)
		}

		const themePayload = await applyThemeToConversation({
			conversation,
			themeKey: normalizedThemeKey,
			userId,
		})

		const systemMessage = await createThemeChangeSystemMessage({
			conversationId: conversationId,
			userId,
			username: req.user.username,
			theme: themePayload,
		})

		const io = req.app.get('io')
		const changedAt = new Date()
		const broadcastPayload = {
			conversationId,
			theme: themePayload,
			changedBy: userId,
			changedByUsername: req.user.username,
			changedAt,
		}

		const systemMessagePayload = {
			messageId: systemMessage.message_id,
			conversationId,
			senderId: systemMessage.sender_id,
			senderUsername: req.user.username,
			content: systemMessage.content,
			createdAt: systemMessage.created_at,
			isEncrypted: false,
			messageType: systemMessage.message_type,
			systemPayload: systemMessage.system_payload,
			files: [],
		}

		if (io && participantIds.length > 0) {
			participantIds.forEach(participantId => {
				io.to(`user:${participantId}`).emit('conversation_theme_changed', broadcastPayload)

				if (conversation.conversation_type === 'private') {
					io.to(`user:${participantId}`).emit('new_private_message', systemMessagePayload)
				} else {
					io.to(`user:${participantId}`).emit('new_group_message', {
						...systemMessagePayload,
						groupId: conversation.group_id,
					})
				}
			})
		}

		res.json({
			success: true,
			message: 'Motyw został zaktualizowany',
			theme: themePayload,
			systemMessage: {
				message_id: systemMessage.message_id,
				content: systemMessage.content,
				message_type: systemMessage.message_type,
				system_payload: systemMessage.system_payload,
				created_at: systemMessage.created_at,
				sender_id: systemMessage.sender_id,
			},
		})
	} catch (error) {
		console.error('❌ Błąd ustawiania motywu konwersacji:', error)
		const statusCode = error.statusCode || 500
		res.status(statusCode).json({
			error: statusCode === 500 ? 'Błąd serwera podczas ustawiania motywu' : error.message,
		})
	}
}

/**
 * Pobieranie ustawień konwersacji (w tym trybu znikających wiadomości)
 */
exports.getConversationSettings = async (req, res) => {
	try {
		const { conversationId } = req.params
		const userId = req.user.userId

		// Sprawdź czy konwersacja istnieje
		const conversation = await db.Conversation.findByPk(conversationId, {
			attributes: [
				'conversation_id',
				'conversation_type',
				'disappearing_messages_enabled',
				'disappearing_messages_enabled_at',
				'disappearing_messages_enabled_by',
				'theme_key',
				'theme_settings',
			],
		})

		if (!conversation) {
			return res.status(404).json({
				error: 'Konwersacja nie znaleziona',
			})
		}

		// Sprawdź dostęp użytkownika
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
					error: 'Nie jesteś członkiem tej grupy',
				})
			}
		}

		// Pobierz czas znikania użytkownika który włączył tryb
		let disappearingTime = null
		if (conversation.disappearing_messages_enabled_by) {
			const enabledByUser = await db.User.findByPk(conversation.disappearing_messages_enabled_by, {
				attributes: ['default_disappearing_time'],
			})
			if (enabledByUser) {
				disappearingTime = enabledByUser.default_disappearing_time
			}
		}

		const resolvedTheme = resolveThemeForConversation(conversation)

		res.json({
			success: true,
			settings: {
				disappearing_messages_enabled: conversation.disappearing_messages_enabled,
				disappearing_messages_enabled_at: conversation.disappearing_messages_enabled_at,
				disappearing_messages_enabled_by: conversation.disappearing_messages_enabled_by,
				disappearing_time: disappearingTime, // Czas znikania użytkownika który włączył tryb
				theme: resolvedTheme,
			},
		})
	} catch (error) {
		console.error('❌ Błąd pobierania ustawień konwersacji:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania ustawień',
		})
	}
}
