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

				// Pobierz uczestników konwersacji
				const participants = await db.ConversationParticipant.findAll({
					where: { conversation_id: conversationId },
				})

				// Utwórz statusy odczytania dla wszystkich uczestników (oprócz nadawcy)
				for (const participant of participants) {
					if (participant.user_id !== socket.userId) {
						await db.MessageReadStatus.create({
							message_id: message.message_id,
							user_id: participant.user_id,
							is_read: false,
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
		socket.on('send_group_message', async data => {
			try {
				const { conversationId, groupId, content } = data

				// Zapisz wiadomość do bazy danych
				const message = await db.Message.create({
					conversation_id: conversationId,
					sender_id: socket.userId,
					content: content,
				})

				// Pobierz wszystkich zaakceptowanych członków grupy
				const groupMembers = await db.GroupMember.findAll({
					where: {
						group_id: groupId,
						status: 'accepted',
					},
				})

				// Utwórz statusy odczytania dla wszystkich członków (oprócz nadawcy)
				for (const member of groupMembers) {
					if (member.user_id !== socket.userId) {
						await db.MessageReadStatus.create({
							message_id: message.message_id,
							user_id: member.user_id,
							is_read: false,
						})
					}
				}

				// Wyślij wiadomość do wszystkich członków grupy
				const messageData = {
					messageId: message.message_id,
					conversationId,
					groupId,
					senderId: socket.userId,
					senderUsername: socket.username,
					content,
					createdAt: message.created_at,
				}

				groupMembers.forEach(member => {
					io.to(`user:${member.user_id}`).emit('new_group_message', messageData)
				})
			} catch (error) {
				console.error('❌ Błąd wysyłania wiadomości grupowej:', error)
				socket.emit('error', { message: 'Nie udało się wysłać wiadomości grupowej' })
			}
		})

		// ==================== OZNACZANIE WIADOMOŚCI JAKO PRZECZYTANEJ ====================
		socket.on('mark_message_read', async data => {
			try {
				const { messageId } = data

				// Zaktualizuj status odczytania
				const [updated] = await db.MessageReadStatus.update(
					{
						is_read: true,
						read_at: new Date(),
					},
					{
						where: {
							message_id: messageId,
							user_id: socket.userId,
						},
					}
				)

				if (updated) {
					// Pobierz informację o nadawcy wiadomości
					const message = await db.Message.findByPk(messageId)

					// Powiadom nadawcę o przeczytaniu wiadomości
					io.to(`user:${message.sender_id}`).emit('message_read', {
						messageId,
						readBy: socket.userId,
						readByUsername: socket.username,
						readAt: new Date(),
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
