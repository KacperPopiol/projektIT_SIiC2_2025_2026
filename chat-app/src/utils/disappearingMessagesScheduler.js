const db = require('../models')
const { Op } = require('sequelize')

let intervalId = null
let ioInstance = null

/**
 * Scheduler do automatycznego usuwania wiadomości z znikających chatów
 * Sprawdza co 30 sekund wszystkie MessageReadStatus gdzie delete_at <= NOW() i is_read = true
 */
const runScheduler = async () => {
	try {
		const now = new Date()

		// Znajdź wszystkie wpisy gdzie delete_at już minęło i wiadomość jest przeczytana
		const expiredReadStatuses = await db.MessageReadStatus.findAll({
			where: {
				is_read: true,
				delete_at: {
					[Op.lte]: now,
				},
			},
			attributes: ['status_id', 'message_id', 'user_id'],
		})

		if (expiredReadStatuses.length === 0) {
			return
		}

		console.log(`🕐 Scheduler: Znaleziono ${expiredReadStatuses.length} wiadomości do usunięcia`)

		// Dla każdego wpisu dodaj do DeletedMessage (jeśli jeszcze nie istnieje)
		for (const readStatus of expiredReadStatuses) {
			try {
				// Sprawdź czy już nie jest usunięta
				const existingDeletion = await db.DeletedMessage.findOne({
					where: {
						message_id: readStatus.message_id,
						user_id: readStatus.user_id,
					},
				})

				if (!existingDeletion) {
					// Dodaj do DeletedMessage
					await db.DeletedMessage.create({
						message_id: readStatus.message_id,
						user_id: readStatus.user_id,
					})

					// Emit socket event do użytkownika w czasie rzeczywistym
					if (ioInstance) {
						ioInstance.to(`user:${readStatus.user_id}`).emit('message_disappeared', {
							messageId: readStatus.message_id,
							userId: readStatus.user_id,
						})
					}

					console.log(
						`🗑️ Scheduler: Usunięto wiadomość ${readStatus.message_id} dla użytkownika ${readStatus.user_id}`
					)
				}
			} catch (error) {
				console.error(`❌ Błąd usuwania wiadomości ${readStatus.message_id}:`, error)
			}
		}
	} catch (error) {
		console.error('❌ Błąd schedulera znikających wiadomości:', error)
	}
}

/**
 * Uruchom scheduler
 * @param {SocketIO.Server} io - Instance Socket.io do emisji eventów
 */
const start = (io = null) => {
	if (intervalId) {
		console.log('⚠️ Scheduler znikających wiadomości już działa')
		return
	}

	ioInstance = io

	console.log('🚀 Uruchamianie schedulera znikających wiadomości (co 30 sekund)')
	
	// Uruchom natychmiast
	runScheduler()

	// Uruchom co 30 sekund
	intervalId = setInterval(runScheduler, 30000)
}

/**
 * Zatrzymaj scheduler
 */
const stop = () => {
	if (intervalId) {
		clearInterval(intervalId)
		intervalId = null
		console.log('🛑 Scheduler znikających wiadomości zatrzymany')
	}
}

module.exports = {
	start,
	stop,
	runScheduler,
}

