const db = require('../models')
const { generateInviteCode, getExpirationDate, isCodeValid } = require('../utils/generateCode')
const { Op } = require('sequelize')

/**
 * Generowanie kodu zaproszeniowego dla użytkownika (ważny 60 sekund)
 */
exports.generateInviteCode = async (req, res) => {
	try {
		const userId = req.user.userId

		// Generuj unikalny kod (powtarzaj aż znajdziesz wolny)
		let inviteCode
		let isUnique = false

		while (!isUnique) {
			inviteCode = generateInviteCode()
			const existing = await db.UserInviteCode.findOne({
				where: { invite_code: inviteCode },
			})
			if (!existing) isUnique = true
		}

		// Utwórz kod z czasem wygaśnięcia (60 sekund)
		const code = await db.UserInviteCode.create({
			user_id: userId,
			invite_code: inviteCode,
			expires_at: getExpirationDate(),
		})

		res.json({
			success: true,
			inviteCode: code.invite_code,
			expiresAt: code.expires_at,
			validFor: '60 sekund',
		})
	} catch (error) {
		console.error('❌ Błąd generowania kodu zaproszeniowego:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas generowania kodu',
		})
	}
}

/**
 * Wysłanie zaproszenia do znajomych używając kodu
 */
exports.sendInvitation = async (req, res) => {
	try {
		const { inviteCode } = req.body
		const requesterId = req.user.userId

		// Znajdź kod zaproszeniowy
		const invite = await db.UserInviteCode.findOne({
			where: {
				invite_code: inviteCode,
				used: false,
			},
			include: [
				{
					model: db.User,
					as: 'user',
					attributes: ['user_id', 'username'],
				},
			],
		})

		if (!invite) {
			return res.status(404).json({
				error: 'Nieprawidłowy kod zaproszeniowy lub kod został już użyty',
			})
		}

		// Sprawdź czy kod nie wygasł (60 sekund)
		if (!isCodeValid(invite.expires_at)) {
			return res.status(400).json({
				error: 'Kod zaproszeniowy wygasł. Kody są ważne tylko przez 60 sekund.',
			})
		}

		// Sprawdź czy nie zaprasza sam siebie
		if (invite.user_id === requesterId) {
			return res.status(400).json({
				error: 'Nie możesz zaprosić sam siebie',
			})
		}

		// Sprawdź czy zaproszenie lub znajomość już istnieje
		const existingContact = await db.Contact.findOne({
			where: {
				[Op.or]: [
					{ user_id: requesterId, contact_user_id: invite.user_id },
					{ user_id: invite.user_id, contact_user_id: requesterId },
				],
			},
		})

		if (existingContact) {
			if (existingContact.status === 'accepted') {
				return res.status(400).json({
					error: 'Jesteście już znajomymi',
				})
			} else if (existingContact.status === 'pending') {
				return res.status(400).json({
					error: 'Zaproszenie już istnieje i oczekuje na akceptację',
				})
			}
		}

		// Utwórz dwa wpisy kontaktów (dla obu użytkowników - relacja dwustronna)
		await db.Contact.bulkCreate([
			{
				user_id: requesterId,
				contact_user_id: invite.user_id,
				status: 'pending',
				requested_by: requesterId,
			},
			{
				user_id: invite.user_id,
				contact_user_id: requesterId,
				status: 'pending',
				requested_by: requesterId,
			},
		])

		// Oznacz kod jako użyty
		await invite.update({ used: true })

		res.json({
			success: true,
			message: 'Zaproszenie wysłane pomyślnie',
			targetUserId: invite.user_id,
			targetUsername: invite.user.username,
		})
	} catch (error) {
		console.error('❌ Błąd wysyłania zaproszenia:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas wysyłania zaproszenia',
		})
	}
}

/**
 * Akceptacja zaproszenia do znajomych
 */
exports.acceptInvitation = async (req, res) => {
	try {
		const { contactId } = req.params
		const userId = req.user.userId

		// Znajdź zaproszenie
		const contact = await db.Contact.findOne({
			where: {
				contact_id: contactId,
				user_id: userId,
				status: 'pending',
			},
		})

		if (!contact) {
			return res.status(404).json({
				error: 'Zaproszenie nie znalezione lub już przetworzone',
			})
		}

		// Sprawdź czy to nie nasza własna prośba
		if (contact.requested_by === userId) {
			return res.status(400).json({
				error: 'Nie możesz zaakceptować własnego zaproszenia. Poczekaj aż druga osoba je zaakceptuje.',
			})
		}

		// Aktualizuj oba wpisy kontaktów na 'accepted'
		await db.Contact.update(
			{ status: 'accepted' },
			{
				where: {
					[Op.or]: [
						{ user_id: userId, contact_user_id: contact.contact_user_id },
						{ user_id: contact.contact_user_id, contact_user_id: userId },
					],
				},
			}
		)

		// Utwórz konwersację prywatną między dwoma użytkownikami
		const conversation = await db.Conversation.create({
			conversation_type: 'private',
		})

		// Dodaj obu użytkowników jako uczestników konwersacji
		await db.ConversationParticipant.bulkCreate([
			{
				conversation_id: conversation.conversation_id,
				user_id: userId,
			},
			{
				conversation_id: conversation.conversation_id,
				user_id: contact.contact_user_id,
			},
		])

		res.json({
			success: true,
			message: 'Zaproszenie zaakceptowane. Możecie teraz ze sobą rozmawiać.',
			conversationId: conversation.conversation_id,
		})
	} catch (error) {
		console.error('❌ Błąd akceptacji zaproszenia:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas akceptacji zaproszenia',
		})
	}
}

/**
 * Odrzucenie zaproszenia do znajomych
 */
exports.rejectInvitation = async (req, res) => {
	try {
		const { contactId } = req.params
		const userId = req.user.userId

		const contact = await db.Contact.findOne({
			where: {
				contact_id: contactId,
				user_id: userId,
				status: 'pending',
			},
		})

		if (!contact) {
			return res.status(404).json({
				error: 'Zaproszenie nie znalezione',
			})
		}

		// Sprawdź czy to nie nasza własna prośba
		if (contact.requested_by === userId) {
			return res.status(400).json({
				error: 'Nie możesz odrzucić własnego zaproszenia. Użyj anulowania zamiast tego.',
			})
		}

		// Usuń oba wpisy kontaktów
		await db.Contact.destroy({
			where: {
				[Op.or]: [
					{ user_id: userId, contact_user_id: contact.contact_user_id },
					{ user_id: contact.contact_user_id, contact_user_id: userId },
				],
			},
		})

		res.json({
			success: true,
			message: 'Zaproszenie odrzucone',
		})
	} catch (error) {
		console.error('❌ Błąd odrzucania zaproszenia:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas odrzucania zaproszenia',
		})
	}
}

/**
 * Pobieranie listy zaakceptowanych znajomych
 */
exports.getContacts = async (req, res) => {
	try {
		const userId = req.user.userId

		const contacts = await db.Contact.findAll({
			where: {
				user_id: userId,
				status: 'accepted',
			},
			include: [
				{
					model: db.User,
					as: 'contactUser',
					attributes: ['user_id', 'username', 'avatar_url'],
				},
			],
			order: [['updated_at', 'DESC']],
		})

		res.json({
			success: true,
			count: contacts.length,
			contacts,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania kontaktów:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania kontaktów',
		})
	}
}

/**
 * Pobieranie oczekujących zaproszeń (otrzymanych od innych)
 */
exports.getPendingInvitations = async (req, res) => {
	try {
		const userId = req.user.userId

		const invitations = await db.Contact.findAll({
			where: {
				user_id: userId,
				status: 'pending',
				requested_by: { [Op.ne]: userId }, // Nie wyświetlaj wysłanych przez nas zaproszeń
			},
			include: [
				{
					model: db.User,
					as: 'contactUser',
					attributes: ['user_id', 'username', 'avatar_url'],
				},
			],
			order: [['created_at', 'DESC']],
		})

		res.json({
			success: true,
			count: invitations.length,
			invitations,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania zaproszeń:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania zaproszeń',
		})
	}
}

/**
 * Pobieranie wysłanych zaproszeń (przez nas, czekających na akceptację)
 */
exports.getSentInvitations = async (req, res) => {
	try {
		const userId = req.user.userId

		const sentInvitations = await db.Contact.findAll({
			where: {
				user_id: userId,
				status: 'pending',
				requested_by: userId, // Tylko nasze wysłane zaproszenia
			},
			include: [
				{
					model: db.User,
					as: 'contactUser',
					attributes: ['user_id', 'username', 'avatar_url'],
				},
			],
			order: [['created_at', 'DESC']],
		})

		res.json({
			success: true,
			count: sentInvitations.length,
			sentInvitations,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania wysłanych zaproszeń:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania wysłanych zaproszeń',
		})
	}
}

/**
 * Wyszukiwanie znajomego po username (tylko wśród zaakceptowanych znajomych)
 */
exports.searchContact = async (req, res) => {
	try {
		const userId = req.user.userId
		const { username } = req.query

		if (!username) {
			return res.status(400).json({
				error: 'Parametr username jest wymagany',
			})
		}

		const contacts = await db.Contact.findAll({
			where: {
				user_id: userId,
				status: 'accepted',
			},
			include: [
				{
					model: db.User,
					as: 'contactUser',
					attributes: ['user_id', 'username', 'avatar_url'],
					where: {
						username: {
							[Op.like]: `%${username}%`,
						},
					},
				},
			],
		})

		res.json({
			success: true,
			count: contacts.length,
			contacts,
		})
	} catch (error) {
		console.error('❌ Błąd wyszukiwania kontaktu:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas wyszukiwania kontaktu',
		})
	}
}

exports.deleteContact = async (req, res) => {
	try {
		const userId = req.user.userId
		const { contactId } = req.params

		// Znajdź kontakt (zaakceptowany znajomy)
		const contact = await db.Contact.findOne({
			where: {
				contact_id: contactId,
				status: 'accepted',
				[Op.or]: [{ user_id: userId }, { contact_user_id: userId }],
			},
		})

		if (!contact) {
			return res.status(404).json({
				success: false,
				error: 'Znajomy nie został znaleziony lub nie jest zaakceptowany',
			})
		}

		// ✅ NOWE: Znajdź konwersację między tymi użytkownikami
		const otherUserId = contact.user_id === userId ? contact.contact_user_id : contact.user_id

		// Znajdź wspólną konwersację
		const participant1 = await db.ConversationParticipant.findOne({
			where: { user_id: userId },
		})

		if (participant1) {
			// Sprawdź czy druga osoba też jest w tej konwersacji
			const participant2 = await db.ConversationParticipant.findOne({
				where: {
					conversation_id: participant1.conversation_id,
					user_id: otherUserId,
				},
			})

			if (participant2) {
				// Sprawdź czy to konwersacja prywatna (2 osoby)
				const participantsCount = await db.ConversationParticipant.count({
					where: { conversation_id: participant1.conversation_id },
				})

				if (participantsCount === 2) {
					// Zarchiwizuj konwersację dla usuwającego
					await participant1.update({
						is_archived: true,
						archived_at: new Date(),
					})

					console.log(`✅ Zarchiwizowano konwersację ${participant1.conversation_id} dla użytkownika ${userId}`)
				}
			}
		}

		// Usuń oba wpisy kontaktów (dwustronnie)
		await db.Contact.destroy({
			where: {
				[Op.or]: [
					{ user_id: userId, contact_user_id: otherUserId },
					{ user_id: otherUserId, contact_user_id: userId },
				],
			},
		})

		res.json({
			success: true,
			message: 'Znajomy został usunięty i konwersacja zarchiwizowana',
		})
	} catch (error) {
		console.error('❌ Błąd usuwania znajomego:', error)
		res.status(500).json({
			success: false,
			error: 'Wystąpił błąd podczas usuwania znajomego',
		})
	}
}
