const db = require('../models')

/**
 * Zapisz klucze ECDH (publiczny + zaszyfrowany prywatny)
 */
exports.saveECDHKeys = async (req, res) => {
	try {
		const userId = req.user.userId
		const { publicKey, encryptedPrivateKey } = req.body

		await db.User.update(
			{
				public_key_dh: publicKey,
				encrypted_private_key_dh: encryptedPrivateKey,
			},
			{ where: { user_id: userId } }
		)

		res.json({
			success: true,
			message: 'Klucze ECDH zapisane',
		})
	} catch (error) {
		console.error('❌ Błąd zapisywania kluczy ECDH:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

/**
 * Pobierz klucz publiczny użytkownika
 */
exports.getPublicKeyDH = async (req, res) => {
	try {
		const { userId } = req.params

		const user = await db.User.findByPk(userId, {
			attributes: ['public_key_dh'],
		})

		if (!user || !user.public_key_dh) {
			return res.status(404).json({ error: 'Użytkownik nie ma klucza publicznego' })
		}

		res.json({
			success: true,
			publicKey: user.public_key_dh,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania klucza publicznego:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

/**
 * Pobierz zaszyfrowany klucz prywatny (backup)
 */
exports.getEncryptedPrivateKeyDH = async (req, res) => {
	try {
		const userId = req.user.userId

		const user = await db.User.findByPk(userId, {
			attributes: ['encrypted_private_key_dh'],
		})

		if (!user || !user.encrypted_private_key_dh) {
			return res.status(404).json({ error: 'Brak backupu klucza prywatnego' })
		}

		res.json({
			success: true,
			encryptedPrivateKey: user.encrypted_private_key_dh,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania klucza prywatnego:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

/**
 * Pobierz klucze publiczne wszystkich uczestników konwersacji
 */
exports.getConversationPublicKeys = async (req, res) => {
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

		// Pobierz uczestników
		const participants = await db.ConversationParticipant.findAll({
			where: { conversation_id: conversationId },
			include: [
				{
					model: db.User,
					as: 'user',
					attributes: ['user_id', 'username', 'public_key_dh'],
				},
			],
		})

		const publicKeys = participants.map(p => ({
			userId: p.user.user_id,
			username: p.user.username,
			publicKey: p.user.public_key_dh,
		}))

		res.json({
			success: true,
			publicKeys,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania kluczy konwersacji:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}
