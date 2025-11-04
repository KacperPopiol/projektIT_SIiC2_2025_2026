const db = require('../models')
const jwt = require('jsonwebtoken')

/**
 * Obsługa wszystkich zdarzeń Socket.io dla komunikacji w czasie rzeczywistym
 */
module.exports = io => {
	// Middleware autoryzacji Socket.io
	io.use((socket, next) => {
		const token = socket.handshake.auth.token

		if (!token) {
			return next(new Error('Brak tokenu autoryzacyjnego'))
		}

		jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
			if (err) {
				return next(new Error('Nieprawidłowy token'))
			}
			socket.userId = decoded.userId
			socket.username = decoded.username
			next()
		})
	})

	io.on('connection', socket => {
		console.log(`✅ Użytkownik połączony: ${socket.username} (ID: ${socket.userId})`)

		// Dołączenie użytkownika do jego osobistego pokoju
		socket.join(`user:${socket.userId}`)

		// ==================== WYSYŁANIE WIADOMOŚCI PRYWATNEJ ====================
		// ==================== WYSYŁANIE WIADOMOŚCI PRYWATNEJ ====================
		socket.on('send_private_message', async data => {
			try {
				const { conversationId, content, isEncrypted = false } = data

				// Walidacja danych
				if (!conversationId || !content?.trim()) {
					socket.emit('error', {
						message: 'Brak wymaganych danych (conversationId lub content)',
						code: 'INVALID_DATA',
					})
					return
				}

				// ✅ SPRAWDŹ CZY KONWERSACJA ISTNIEJE I CZY TO PRIVATE
				const conversation = await db.Conversation.findByPk(conversationId)

				if (!conversation) {
					socket.emit('error', {
						message: 'Konwersacja nie znaleziona',
						code: 'NOT_FOUND',
					})
					return
				}

				// ✅ JEŚLI PRIVATE - SPRAWDŹ CZY SĄ ZNAJOMYMI
				if (conversation.conversation_type === 'private') {
					// Znajdź wszystkich uczestników
					const participants = await db.ConversationParticipant.findAll({
						where: { conversation_id: conversationId },
						attributes: ['user_id'],
					})

					// Znajdź drugiego użytkownika (nie siebie)
					const otherParticipant = participants.find(p => p.user_id !== socket.userId)

					if (!otherParticipant) {
						socket.emit('error', {
							message: 'Odbiorca nie znaleziony w konwersacji',
							code: 'RECIPIENT_NOT_FOUND',
						})
						return
					}

					const otherUserId = otherParticipant.user_id

					// ✅ SPRAWDŹ CZY ISTNIEJE ZAAKCEPTOWANA ZNAJOMOŚĆ
					const { Op } = require('sequelize')

					const friendship = await db.Contact.findOne({
						where: {
							status: 'accepted',
							[Op.or]: [
								{ user_id: socket.userId, contact_user_id: otherUserId },
								{ user_id: otherUserId, contact_user_id: socket.userId },
							],
						},
					})

					if (!friendship) {
						socket.emit('error', {
							message:
								'Nie możesz wysłać wiadomości - musicie być znajomymi. Dodaj tę osobę ponownie w zakładce "Znajomi".',
							code: 'NOT_FRIENDS',
						})
						return
					}
				}

				// ✅ JEŚLI WSZYSTKO OK - ZAPISZ WIADOMOŚĆ
				const message = await db.Message.create({
					conversation_id: conversationId,
					sender_id: socket.userId,
					content: content,
					is_encrypted: isEncrypted,
				})

				// Pobierz ustawienia konwersacji (czy tryb znikających włączony)
				const conversationSettings = await db.Conversation.findByPk(conversationId, {
					attributes: [
						'disappearing_messages_enabled',
						'disappearing_messages_enabled_at',
						'disappearing_messages_enabled_by',
					],
				})

				// Pobierz uczestników konwersacji
				const participants = await db.ConversationParticipant.findAll({
					where: { conversation_id: conversationId },
				})

				// Sprawdź czy tryb znikających jest włączony i czy wiadomość została wysłana po włączeniu
				let deleteAtSender = null
				if (
					conversationSettings?.disappearing_messages_enabled &&
					conversationSettings?.disappearing_messages_enabled_at &&
					conversationSettings?.disappearing_messages_enabled_by &&
					new Date(message.created_at) >= new Date(conversationSettings.disappearing_messages_enabled_at)
				) {
					// Pobierz czas znikania użytkownika który włączył tryb
					const enabledByUser = await db.User.findByPk(conversationSettings.disappearing_messages_enabled_by, {
						attributes: ['default_disappearing_time'],
					})

					if (enabledByUser && enabledByUser.default_disappearing_time) {
						// Dla nadawcy: delete_at = created_at + czas znikania (wysyłający "czyta" wiadomość od razu)
						deleteAtSender = new Date(
							new Date(message.created_at).getTime() + enabledByUser.default_disappearing_time * 1000
						)
					}
				}

				// Utwórz statusy odczytania dla wszystkich uczestników (włącznie z nadawcą jeśli tryb znikających włączony)
				for (const participant of participants) {
					if (participant.user_id !== socket.userId) {
						// Dla odbiorców: is_read = false (będzie true gdy przeczytają)
						await db.MessageReadStatus.create({
							message_id: message.message_id,
							user_id: participant.user_id,
							is_read: false,
						})
					} else if (deleteAtSender !== null) {
						// Dla nadawcy: is_read = true i delete_at ustawiony (wysyłający "czyta" wiadomość od razu)
						await db.MessageReadStatus.create({
							message_id: message.message_id,
							user_id: socket.userId,
							is_read: true,
							read_at: message.created_at,
							delete_at: deleteAtSender,
						})
					}
				}

				// Wyślij wiadomość do wszystkich uczestników konwersacji
				const messageData = {
					messageId: message.message_id,
					conversationId,
					senderId: socket.userId,
					senderUsername: socket.username,
					content: content.trim(),
					createdAt: message.created_at,
					isEncrypted: message.is_encrypted,
				}

				participants.forEach(participant => {
					io.to(`user:${participant.user_id}`).emit('new_private_message', messageData)
				})

				// ✅ POTWIERDŹ NADAWCY ŻE WYSŁANO
				socket.emit('message_sent', {
					success: true,
					message: messageData,
				})
			} catch (error) {
				console.error('❌ Błąd wysyłania wiadomości prywatnej:', error)
				socket.emit('error', {
					message: 'Nie udało się wysłać wiadomości',
					code: 'SERVER_ERROR',
				})
			}
		})

		// ==================== WYSYŁANIE WIADOMOŚCI GRUPOWEJ ====================
		// ==================== WYSYŁANIE WIADOMOŚCI GRUPOWEJ ====================
		socket.on('send_group_message', async data => {
			try {
				const { conversationId, groupId, content, encryptedContent, recipientKeys, isEncrypted } = data

				console.log('📨 Otrzymano wiadomość grupową:', {
					conversationId,
					groupId,
					isEncrypted: isEncrypted || false,
					hasContent: !!content,
					hasEncryptedContent: !!encryptedContent,
					recipientKeysCount: recipientKeys ? Object.keys(recipientKeys).length : 0,
				})

				// ✅ Obsłuż ZARÓWNO zaszyfrowane JAK I nieszyfrowane
				const messageContent = encryptedContent || content
				const encrypted = isEncrypted === true

				// Walidacja podstawowa
				if (!conversationId || !groupId || !messageContent) {
					socket.emit('error', {
						message: 'Nieprawidłowe dane wiadomości grupowej',
						code: 'INVALID_DATA',
					})
					return
				}

				// ✅ Walidacja tylko dla zaszyfrowanych wiadomości
				if (
					encrypted &&
					(!recipientKeys || typeof recipientKeys !== 'object' || Object.keys(recipientKeys).length === 0)
				) {
					socket.emit('error', {
						message: 'Brak zaszyfrowanych kluczy dla odbiorców',
						code: 'INVALID_DATA',
					})
					return
				}

				// Sprawdź członkostwo
				const member = await db.GroupMember.findOne({
					where: {
						group_id: groupId,
						user_id: socket.userId,
						status: 'accepted',
					},
				})

				if (!member) {
					socket.emit('error', {
						message: 'Nie jesteś członkiem tej grupy',
						code: 'NOT_MEMBER',
					})
					return
				}

				// Zapisz wiadomość
				const message = await db.Message.create({
					conversation_id: conversationId,
					sender_id: socket.userId,
					content: messageContent,
					is_encrypted: encrypted,
					recipient_keys: encrypted ? JSON.stringify(recipientKeys) : null,
				})

				// Pobierz ustawienia konwersacji (czy tryb znikających włączony)
				const conversationSettings = await db.Conversation.findByPk(conversationId, {
					attributes: [
						'disappearing_messages_enabled',
						'disappearing_messages_enabled_at',
						'disappearing_messages_enabled_by',
					],
				})

				// Pobierz członków grupy
				const groupMembers = await db.GroupMember.findAll({
					where: {
						group_id: groupId,
						status: 'accepted',
					},
				})

				// Sprawdź czy tryb znikających jest włączony i czy wiadomość została wysłana po włączeniu
				let deleteAtSender = null
				if (
					conversationSettings?.disappearing_messages_enabled &&
					conversationSettings?.disappearing_messages_enabled_at &&
					conversationSettings?.disappearing_messages_enabled_by &&
					new Date(message.created_at) >= new Date(conversationSettings.disappearing_messages_enabled_at)
				) {
					// Pobierz czas znikania użytkownika który włączył tryb
					const enabledByUser = await db.User.findByPk(conversationSettings.disappearing_messages_enabled_by, {
						attributes: ['default_disappearing_time'],
					})

					if (enabledByUser && enabledByUser.default_disappearing_time) {
						// Dla nadawcy: delete_at = created_at + czas znikania (wysyłający "czyta" wiadomość od razu)
						deleteAtSender = new Date(
							new Date(message.created_at).getTime() + enabledByUser.default_disappearing_time * 1000
						)
					}
				}

				// Utwórz statusy odczytania
				const readStatuses = groupMembers
					.filter(m => m.user_id !== socket.userId)
					.map(m => ({
						message_id: message.message_id,
						user_id: m.user_id,
						is_read: false,
					}))

				// Dodaj status dla nadawcy jeśli tryb znikających włączony
				if (deleteAtSender !== null) {
					readStatuses.push({
						message_id: message.message_id,
						user_id: socket.userId,
						is_read: true,
						read_at: message.created_at,
						delete_at: deleteAtSender,
					})
				}

				if (readStatuses.length > 0) {
					await db.MessageReadStatus.bulkCreate(readStatuses)
				}

				// ✅ Wyślij do wszystkich członków (z odpowiednimi danymi)
				groupMembers.forEach(member => {
					const messageData = {
						messageId: message.message_id,
						conversationId,
						groupId,
						senderId: socket.userId,
						senderUsername: socket.username,
						content: message.content,
						isEncrypted: encrypted,
						createdAt: message.created_at,
						encryptedGroupKey: encrypted ? recipientKeys[member.user_id] : null,
					}

					// Wyślij wiadomość
					if (encrypted) {
						// Dla zaszyfrowanych - tylko jeśli ma klucz
						if (messageData.encryptedGroupKey) {
							io.to(`user:${member.user_id}`).emit('new_group_message', messageData)
							console.log(`✅ Wysłano zaszyfrowaną wiadomość do user:${member.user_id}`)
						} else if (member.user_id !== socket.userId) {
							console.warn(`⚠️ Nie wysłano zaszyfrowanej wiadomości do user:${member.user_id} - brak klucza`)
						}
					} else {
						// Dla nieszyfrowanych - wyślij wszystkim
						io.to(`user:${member.user_id}`).emit('new_group_message', messageData)
						console.log(`📤 Wysłano nieszyfrowaną wiadomość do user:${member.user_id}`)
					}
				})

				// Potwierdzenie dla nadawcy
				socket.emit('message_sent', {
					success: true,
					message: {
						messageId: message.message_id,
						conversationId,
						senderId: socket.userId,
						senderUsername: socket.username,
						createdAt: message.created_at,
						isEncrypted: encrypted,
						groupId,
					},
				})

				console.log(`✅ Wiadomość grupowa zapisana (ID: ${message.message_id}, encrypted: ${encrypted})`)
			} catch (error) {
				console.error('❌ Błąd wysyłania wiadomości grupowej:', error)
				socket.emit('error', {
					message: 'Nie udało się wysłać wiadomości grupowej',
					code: 'SERVER_ERROR',
					details: process.env.NODE_ENV === 'development' ? error.message : undefined,
				})
			}
		})

		// ==================== OZNACZANIE WIADOMOŚCI JAKO PRZECZYTANEJ ====================
		socket.on('mark_message_read', async data => {
			try {
				const { messageId } = data
				const readAt = new Date()

				// Pobierz wiadomość i konwersację
				const message = await db.Message.findByPk(messageId, {
					include: [
						{
							model: db.Conversation,
							as: 'conversation',
							attributes: [
								'conversation_id',
								'disappearing_messages_enabled',
								'disappearing_messages_enabled_at',
								'disappearing_messages_enabled_by',
							],
						},
					],
				})

				if (!message) {
					return
				}

				// Sprawdź czy tryb znikających jest włączony i czy wiadomość została wysłana po włączeniu
				let deleteAt = null
				if (
					message.conversation?.disappearing_messages_enabled &&
					message.conversation?.disappearing_messages_enabled_at &&
					message.conversation?.disappearing_messages_enabled_by &&
					new Date(message.created_at) >= new Date(message.conversation.disappearing_messages_enabled_at)
				) {
					// Pobierz domyślny czas znikania użytkownika który WŁĄCZYŁ tryb (nie tego który czyta)
					const enabledByUser = await db.User.findByPk(message.conversation.disappearing_messages_enabled_by, {
						attributes: ['default_disappearing_time'],
					})

					if (enabledByUser && enabledByUser.default_disappearing_time) {
						// Oblicz delete_at = read_at + default_disappearing_time użytkownika który włączył tryb
						deleteAt = new Date(readAt.getTime() + enabledByUser.default_disappearing_time * 1000)
					}
				}

				// Zaktualizuj status odczytania z delete_at jeśli potrzebne
				const updateData = {
					is_read: true,
					read_at: readAt,
				}

				if (deleteAt) {
					updateData.delete_at = deleteAt
				}

				const [updated] = await db.MessageReadStatus.update(updateData, {
					where: {
						message_id: messageId,
						user_id: socket.userId,
					},
				})

				if (updated) {
					// Powiadom nadawcę o przeczytaniu wiadomości
					io.to(`user:${message.sender_id}`).emit('message_read', {
						messageId,
						readBy: socket.userId,
						readByUsername: socket.username,
						readAt: readAt,
						deleteAt: deleteAt,
					})
				}
			} catch (error) {
				console.error('❌ Błąd oznaczania wiadomości jako przeczytanej:', error)
			}
		})

		// ==================== DOŁĄCZANIE DO POKOJU KONWERSACJI ====================
		socket.on('join_conversation', data => {
			const { conversationId } = data
			socket.join(`conversation:${conversationId}`)
			console.log(`👥 ${socket.username} dołączył do konwersacji ${conversationId}`)
		})

		// ==================== OPUSZCZANIE POKOJU KONWERSACJI ====================
		socket.on('leave_conversation', data => {
			const { conversationId } = data
			socket.leave(`conversation:${conversationId}`)
			console.log(`👋 ${socket.username} opuścił konwersację ${conversationId}`)
		})

		// ==================== DOŁĄCZANIE DO POKOJU GRUPY ====================
		socket.on('join_group', data => {
			const { groupId } = data
			socket.join(`group:${groupId}`)
			console.log(`👥 ${socket.username} dołączył do grupy ${groupId}`)
		})

		// ==================== OPUSZCZANIE POKOJU GRUPY ====================
		socket.on('leave_group', data => {
			const { groupId } = data
			socket.leave(`group:${groupId}`)
			console.log(`👋 ${socket.username} opuścił grupę ${groupId}`)
		})

		// ==================== WSKAŹNIK PISANIA (TYPING) ====================
		socket.on('typing', data => {
			const { conversationId, isGroup, groupId } = data

			const typingData = {
				userId: socket.userId,
				username: socket.username,
				conversationId,
			}

			if (isGroup) {
				socket.to(`group:${groupId}`).emit('user_typing', typingData)
			} else {
				socket.to(`conversation:${conversationId}`).emit('user_typing', typingData)
			}
		})

		// ==================== PRZESTANIE PISAĆ ====================
		socket.on('stop_typing', data => {
			const { conversationId, isGroup, groupId } = data

			const typingData = {
				userId: socket.userId,
				conversationId,
			}

			if (isGroup) {
				socket.to(`group:${groupId}`).emit('user_stop_typing', typingData)
			} else {
				socket.to(`conversation:${conversationId}`).emit('user_stop_typing', typingData)
			}
		})

		// ==================== ZNIKAJĄCE WIADOMOŚCI ====================
		socket.on('toggle_disappearing_messages', async data => {
			try {
				const { conversationId, enabled } = data

				if (!conversationId || typeof enabled !== 'boolean') {
					socket.emit('error', {
						message: 'Brak wymaganych danych (conversationId lub enabled)',
						code: 'INVALID_DATA',
					})
					return
				}

				// Sprawdź czy konwersacja istnieje
				const conversation = await db.Conversation.findByPk(conversationId)

				if (!conversation) {
					socket.emit('error', {
						message: 'Konwersacja nie znaleziona',
						code: 'NOT_FOUND',
					})
					return
				}

				// Sprawdź dostęp użytkownika do konwersacji
				if (conversation.conversation_type === 'private') {
					const participant = await db.ConversationParticipant.findOne({
						where: {
							conversation_id: conversationId,
							user_id: socket.userId,
						},
					})

					if (!participant) {
						socket.emit('error', {
							message: 'Nie masz dostępu do tej konwersacji',
							code: 'ACCESS_DENIED',
						})
						return
					}
				} else if (conversation.conversation_type === 'group') {
					const member = await db.GroupMember.findOne({
						where: {
							group_id: conversation.group_id,
							user_id: socket.userId,
							status: 'accepted',
						},
					})

					if (!member) {
						socket.emit('error', {
							message: 'Nie jesteś członkiem tej grupy',
							code: 'NOT_MEMBER',
						})
						return
					}
				}

				// Aktualizuj ustawienia konwersacji
				const updateData = {
					disappearing_messages_enabled: enabled,
				}

				if (enabled) {
					updateData.disappearing_messages_enabled_at = new Date()
					updateData.disappearing_messages_enabled_by = socket.userId
				} else {
					updateData.disappearing_messages_enabled_at = null
					updateData.disappearing_messages_enabled_by = null
				}

				await conversation.update(updateData)

				// Pobierz czas znikania użytkownika który włączył tryb
				let disappearingTime = null
				if (enabled) {
					const enabledByUser = await db.User.findByPk(socket.userId, {
						attributes: ['default_disappearing_time'],
					})
					if (enabledByUser) {
						disappearingTime = enabledByUser.default_disappearing_time
					}
				}

				// Pobierz wszystkich uczestników konwersacji
				let participants = []
				if (conversation.conversation_type === 'private') {
					const convParticipants = await db.ConversationParticipant.findAll({
						where: { conversation_id: conversationId },
						attributes: ['user_id'],
					})
					participants = convParticipants.map(p => p.user_id)
				} else {
					const groupMembers = await db.GroupMember.findAll({
						where: {
							group_id: conversation.group_id,
							status: 'accepted',
						},
						attributes: ['user_id'],
					})
					participants = groupMembers.map(m => m.user_id)
				}

				// Broadcast do wszystkich uczestników
				const broadcastData = {
					conversationId,
					enabled,
					enabledBy: enabled ? socket.userId : null,
					enabledByUsername: enabled ? socket.username : null,
					enabledAt: enabled ? conversation.disappearing_messages_enabled_at : null,
					disappearingTime: disappearingTime, // Czas znikania użytkownika który włączył tryb
				}

				participants.forEach(userId => {
					io.to(`user:${userId}`).emit('disappearing_messages_toggled', broadcastData)
				})

				console.log(
					`✅ Tryb znikających wiadomości ${enabled ? 'włączony' : 'wyłączony'} dla konwersacji ${conversationId} przez ${socket.username}`
				)
			} catch (error) {
				console.error('❌ Błąd przełączania trybu znikających wiadomości:', error)
				socket.emit('error', {
					message: 'Nie udało się przełączyć trybu znikających wiadomości',
					code: 'SERVER_ERROR',
				})
			}
		})

		// ==================== STATUS ONLINE/OFFLINE ====================
		socket.on('user_online', () => {
			// Powiadom wszystkich znajomych o tym że użytkownik jest online
			socket.broadcast.emit('user_status_change', {
				userId: socket.userId,
				username: socket.username,
				status: 'online',
			})
		})

		// ==================== ROZŁĄCZENIE ====================
		socket.on('disconnect', () => {
			console.log(`❌ Użytkownik rozłączony: ${socket.username} (ID: ${socket.userId})`)

			// Powiadom wszystkich o rozłączeniu
			socket.broadcast.emit('user_status_change', {
				userId: socket.userId,
				username: socket.username,
				status: 'offline',
			})
		})
	})

	console.log('📡 Socket.io handler initialized')
}
