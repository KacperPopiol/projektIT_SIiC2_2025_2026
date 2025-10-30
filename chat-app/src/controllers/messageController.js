const db = require('../models')
const { Op } = require('sequelize')

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
					attributes: ['user_id', 'is_read', 'read_at'],
				},
			],
			attributes: ['message_id', 'conversation_id', 'sender_id', 'content', 'is_encrypted', 'created_at'],
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
			attributes: ['message_id'],
		})

		if (messages.length === 0) {
			return res.json({
				success: true,
				message: 'Brak wiadomości do usunięcia',
			})
		}

		// Dodaj wszystkie wiadomości do tabeli usuniętych
		const deletions = messages.map(msg => ({
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
							attributes: ['message_id', 'sender_id', 'content', 'is_encrypted', 'created_at'],
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
