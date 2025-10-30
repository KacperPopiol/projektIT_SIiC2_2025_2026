const db = require('../models')

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
		console.error('Błąd zapisywania kluczy ECDH:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

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
		console.error('Błąd pobierania klucza publicznego:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

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
		console.error('Błąd pobierania klucza prywatnego:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

exports.getConversationPublicKeys = async (req, res) => {
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
			return res.status(403).json({ error: 'Brak dostępu' })
		}

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
		console.error('Błąd pobierania kluczy konwersacji:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

exports.getGroupPublicKeys = async (req, res) => {
	try {
		const { groupId } = req.params

		console.log('Fetching public keys for group:', groupId)

		const members = await db.GroupMember.findAll({
			where: {
				group_id: groupId,
				status: 'accepted',
			},
			include: [
				{
					model: db.User,
					as: 'user',
					attributes: ['user_id', 'username', 'public_key_dh'],
				},
			],
		})

		console.log('👥 Found members:', members.length)

		const publicKeys = []
		for (const member of members) {
			console.log('Processing member:', {
				memberId: member.user_id,
				hasUser: !!member.user,
				hasPublicKey: !!member.user?.public_key_dh,
			})

			if (member.user?.public_key_dh) {
				publicKeys.push({
					userId: member.user.user_id,
					username: member.user.username,
					publicKey: member.user.public_key_dh,
				})
			}
		}

		res.json({ publicKeys })
	} catch (error) {
		console.error('Error fetching group public keys:')
		console.error('Message:', error.message)
		console.error('Stack:', error.stack)

		res.status(500).json({
			error: 'Failed to fetch group keys',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined,
		})
	}
}

exports.saveGroupKey = async (req, res) => {
	try {
		const { groupId, userId, encryptedGroupKey } = req.body

		const targetUserId = userId || req.user.userId

		await db.GroupEncryptedKey.create({
			group_id: groupId,
			user_id: targetUserId,
			encrypted_key: encryptedGroupKey,
		})

		res.json({ success: true })
	} catch (error) {
		console.error('Error saving group key:', error)
		res.status(500).json({ error: 'Failed to save group key' })
	}
}

exports.getGroupKey = async (req, res) => {
	try {
		const { groupId } = req.params
		const userId = req.user.userId

		const encryptedKey = await db.GroupEncryptedKey.findOne({
			where: {
				group_id: groupId,
				user_id: userId,
			},
			order: [['created_at', 'DESC']],
		})

		if (!encryptedKey) {
			return res.status(404).json({ error: 'Group key not found' })
		}

		res.json({
			encryptedKey: encryptedKey.encrypted_key,
		})
	} catch (error) {
		console.error('Error fetching group key:', error)
		res.status(500).json({ error: 'Failed to fetch group key' })
	}
}
