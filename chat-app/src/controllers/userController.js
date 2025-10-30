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


