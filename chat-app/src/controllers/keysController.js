const db = require('../models')
const crypto = require('crypto')

/**
 * Zapisz klucz publiczny użytkownika i wygeneruj Pre-Keys
 */
exports.savePublicKey = async (req, res) => {
	try {
		const userId = req.user.userId
		const { publicKey, preKeys } = req.body

		if (!publicKey) {
			return res.status(400).json({ error: 'Brak klucza publicznego' })
		}

		// Generuj fingerprint (SHA-256)
		const fingerprint = crypto.createHash('sha256').update(publicKey).digest('hex')

		// Sprawdź czy użytkownik już ma klucze
		let userKey = await db.UserKeys.findOne({
			where: { user_id: userId },
		})

		if (userKey) {
			// Zaktualizuj
			await userKey.update({
				public_key: publicKey,
				key_fingerprint: fingerprint,
				pre_keys: preKeys || [],
			})
		} else {
			// Utwórz nowe
			userKey = await db.UserKeys.create({
				user_id: userId,
				public_key: publicKey,
				key_fingerprint: fingerprint,
				pre_keys: preKeys || [],
			})
		}

		res.json({
			success: true,
			message: 'Klucz publiczny zapisany',
			fingerprint,
		})
	} catch (error) {
		console.error('❌ Błąd zapisywania klucza:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

/**
 * Pobierz klucz publiczny użytkownika
 */
exports.getPublicKey = async (req, res) => {
	try {
		const { userId } = req.params

		const userKey = await db.UserKeys.findOne({
			where: { user_id: userId },
			attributes: ['public_key', 'key_fingerprint'],
		})

		if (!userKey) {
			return res.status(404).json({
				error: 'Użytkownik nie ma klucza publicznego',
			})
		}

		res.json({
			success: true,
			publicKey: userKey.public_key,
			fingerprint: userKey.key_fingerprint,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania klucza:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

/**
 * Pobierz PreKey Bundle dla rozpoczęcia sesji
 */
exports.getPreKeyBundle = async (req, res) => {
	try {
		const { userId } = req.params

		const userKey = await db.UserKeys.findOne({
			where: { user_id: userId },
		})

		if (!userKey) {
			return res.status(404).json({ error: 'Brak kluczy użytkownika' })
		}

		// Pobierz jeden PreKey (jeśli dostępny)
		let preKeys = userKey.pre_keys || []
		let selectedPreKey = null

		if (preKeys.length > 0) {
			selectedPreKey = preKeys[0]
			// Usuń użyty PreKey
			preKeys = preKeys.slice(1)
			await userKey.update({ pre_keys: preKeys })
		}

		res.json({
			success: true,
			bundle: {
				userId: userId,
				publicKey: userKey.public_key,
				preKey: selectedPreKey,
				fingerprint: userKey.key_fingerprint,
			},
		})
	} catch (error) {
		console.error('❌ Błąd pobierania bundle:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

/**
 * Pobierz klucze uczestników konwersacji
 */
exports.getConversationKeys = async (req, res) => {
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
			return res.status(403).json({ error: 'Brak dostępu' })
		}

		// Pobierz uczestników z kluczami
		const participants = await db.ConversationParticipant.findAll({
			where: { conversation_id: conversationId },
			include: [
				{
					model: db.User,
					as: 'user',
					attributes: ['user_id', 'username'],
					include: [
						{
							model: db.UserKeys,
							as: 'keys',
							attributes: ['public_key', 'key_fingerprint'],
						},
					],
				},
			],
		})

		const keys = participants.map(p => ({
			userId: p.user.user_id,
			username: p.user.username,
			publicKey: p.user.keys?.public_key || null,
			fingerprint: p.user.keys?.key_fingerprint || null,
		}))

		res.json({
			success: true,
			keys,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania kluczy konwersacji:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}
