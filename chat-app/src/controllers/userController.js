const db = require('../models')

exports.getNotificationSettings = async (req, res) => {
	try {
		const userId = req.user.userId
		const user = await db.User.findByPk(userId, {
			attributes: ['notifications_enabled', 'notify_private_messages', 'notify_group_messages'],
		})

		return res.json({ success: true, settings: user })
	} catch (error) {
		console.error('Błąd pobierania ustawień powiadomień:', error)
		return res.status(500).json({ error: 'Błąd pobierania ustawień' })
	}
}

exports.updateNotificationSettings = async (req, res) => {
	try {
		const userId = req.user.userId
		const { notifications_enabled, notify_private_messages, notify_group_messages } = req.body

		await db.User.update(
			{
				notifications_enabled,
				notify_private_messages,
				notify_group_messages,
			},
			{ where: { user_id: userId } }
		)

		return res.json({ success: true, message: 'Ustawienia zaktualizowane' })
	} catch (error) {
		console.error('Błąd aktualizacji ustawień powiadomień:', error)
		return res.status(500).json({ error: 'Błąd aktualizacji ustawień' })
	}
}

/**
 * Pobieranie domyślnego czasu znikania wiadomości
 */
exports.getDefaultDisappearingTime = async (req, res) => {
	try {
		const userId = req.user.userId
		const user = await db.User.findByPk(userId, {
			attributes: ['default_disappearing_time'],
		})

		if (!user) {
			return res.status(404).json({ error: 'Użytkownik nie znaleziony' })
		}

		return res.json({
			success: true,
			defaultDisappearingTime: user.default_disappearing_time,
		})
	} catch (error) {
		console.error('Błąd pobierania domyślnego czasu znikania:', error)
		return res.status(500).json({ error: 'Błąd pobierania czasu znikania' })
	}
}

/**
 * Aktualizacja domyślnego czasu znikania wiadomości
 */
exports.updateDefaultDisappearingTime = async (req, res) => {
	try {
		const userId = req.user.userId
		const { timeInSeconds } = req.body

		// Walidacja czasu (dozwolone wartości: 30, 60, 300, 3600, 86400)
		const allowedTimes = [30, 60, 300, 3600, 86400]
		if (!allowedTimes.includes(timeInSeconds)) {
			return res.status(400).json({
				error: 'Nieprawidłowy czas. Dozwolone wartości: 30s, 60s, 300s (5min), 3600s (1h), 86400s (24h)',
			})
		}

		await db.User.update(
			{
				default_disappearing_time: timeInSeconds,
			},
			{ where: { user_id: userId } }
		)

		return res.json({
			success: true,
			message: 'Domyślny czas znikania zaktualizowany',
			defaultDisappearingTime: timeInSeconds,
		})
	} catch (error) {
		console.error('Błąd aktualizacji domyślnego czasu znikania:', error)
		return res.status(500).json({ error: 'Błąd aktualizacji czasu znikania' })
	}
}


