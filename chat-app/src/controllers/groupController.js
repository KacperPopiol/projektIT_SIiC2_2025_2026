const db = require('../models')
const { generateInviteCode, getExpirationDate, isCodeValid } = require('../utils/generateCode')
const { Op } = require('sequelize')

/**
 * Tworzenie nowej grupy
 */
exports.createGroup = async (req, res) => {
	try {
		const { groupName } = req.body
		const userId = req.user.userId

		// Utwórz grupę
		const group = await db.Group.create({
			group_name: groupName,
			creator_id: userId,
		})

		// Dodaj twórcę jako członka grupy z rolą 'creator'
		await db.GroupMember.create({
			group_id: group.group_id,
			user_id: userId,
			role: 'creator',
			status: 'accepted',
			joined_at: new Date(),
		})

		// Utwórz konwersację grupową
		const conversation = await db.Conversation.create({
			conversation_type: 'group',
			group_id: group.group_id,
		})

		res.status(201).json({
			success: true,
			message: 'Grupa utworzona pomyślnie',
			group: {
				groupId: group.group_id,
				groupName: group.group_name,
				creatorId: group.creator_id,
				conversationId: conversation.conversation_id,
			},
			conversationId: conversation.conversation_id,
		})
	} catch (error) {
		console.error('❌ Błąd tworzenia grupy:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas tworzenia grupy',
		})
	}
}

/**
 * Generowanie kodu zaproszeniowego do grupy (ważny 60 sekund)
 */
exports.generateGroupInvite = async (req, res) => {
	try {
		const { groupId } = req.params
		const userId = req.user.userId

		// Sprawdź czy użytkownik jest twórcą grupy
		const group = await db.Group.findByPk(groupId)

		if (!group) {
			return res.status(404).json({
				error: 'Grupa nie znaleziona',
			})
		}

		if (group.creator_id !== userId) {
			return res.status(403).json({
				error: 'Tylko twórca grupy może generować kody zaproszeniowe',
			})
		}

		// Generuj unikalny kod
		let inviteCode
		let isUnique = false

		while (!isUnique) {
			inviteCode = generateInviteCode()
			const existing = await db.GroupInviteCode.findOne({
				where: { invite_code: inviteCode },
			})
			if (!existing) isUnique = true
		}

		// Utwórz kod zaproszeniowy
		const code = await db.GroupInviteCode.create({
			group_id: groupId,
			invite_code: inviteCode,
			created_by: userId,
			expires_at: getExpirationDate(),
		})

		res.json({
			success: true,
			inviteCode: code.invite_code,
			expiresAt: code.expires_at,
			validFor: '60 sekund',
		})
	} catch (error) {
		console.error('❌ Błąd generowania kodu grupowego:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas generowania kodu',
		})
	}
}

/**
 * Wysłanie prośby o dołączenie do grupy używając kodu
 */
exports.requestJoinGroup = async (req, res) => {
	try {
		const { inviteCode } = req.body
		const userId = req.user.userId

		// Znajdź kod zaproszeniowy
		const invite = await db.GroupInviteCode.findOne({
			where: { invite_code: inviteCode },
			include: [
				{
					model: db.Group,
					as: 'group',
					attributes: ['group_id', 'group_name', 'creator_id'],
				},
			],
		})

		if (!invite) {
			return res.status(404).json({
				error: 'Nieprawidłowy kod zaproszeniowy',
			})
		}

		// Sprawdź czy kod nie wygasł
		if (!isCodeValid(invite.expires_at)) {
			return res.status(400).json({
				error: 'Kod zaproszeniowy wygasł. Kody są ważne tylko przez 60 sekund.',
			})
		}

		// Sprawdź czy użytkownik już jest członkiem grupy
		const existingMember = await db.GroupMember.findOne({
			where: {
				group_id: invite.group_id,
				user_id: userId,
			},
		})

		if (existingMember) {
			if (existingMember.status === 'accepted') {
				return res.status(400).json({
					error: 'Jesteś już członkiem tej grupy',
				})
			} else if (existingMember.status === 'pending') {
				return res.status(400).json({
					error: 'Twoja prośba o dołączenie już oczekuje na zatwierdzenie',
				})
			}
		}

		// Utwórz prośbę o dołączenie (status: pending)
		await db.GroupMember.create({
			group_id: invite.group_id,
			user_id: userId,
			role: 'member',
			status: 'pending',
		})

		res.json({
			success: true,
			message: 'Prośba o dołączenie wysłana. Oczekuje na zatwierdzenie przez twórcę grupy.',
			groupId: invite.group_id,
			groupName: invite.group.group_name,
		})
	} catch (error) {
		console.error('❌ Błąd wysyłania prośby o dołączenie:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas wysyłania prośby',
		})
	}
}

/**
 * Zatwierdzenie członka grupy (tylko twórca)
 */
exports.acceptMember = async (req, res) => {
	try {
		const { groupId, memberId } = req.params
		const userId = req.user.userId

		// Sprawdź czy użytkownik jest twórcą grupy
		const group = await db.Group.findByPk(groupId)

		if (!group) {
			return res.status(404).json({
				error: 'Grupa nie znaleziona',
			})
		}

		if (group.creator_id !== userId) {
			return res.status(403).json({
				error: 'Tylko twórca grupy może zatwierdzać członków',
			})
		}

		// Znajdź prośbę o dołączenie
		const member = await db.GroupMember.findOne({
			where: {
				group_id: groupId,
				user_id: memberId,
				status: 'pending',
			},
		})

		if (!member) {
			return res.status(404).json({
				error: 'Prośba o dołączenie nie znaleziona',
			})
		}

		// Zaktualizuj status na 'accepted'
		await member.update({
			status: 'accepted',
			joined_at: new Date(),
		})

		res.json({
			success: true,
			message: 'Członek zatwierdzony pomyślnie',
		})
	} catch (error) {
		console.error('❌ Błąd zatwierdzania członka:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas zatwierdzania członka',
		})
	}
}

/**
 * Odrzucenie członka grupy (tylko twórca)
 */
exports.rejectMember = async (req, res) => {
	try {
		const { groupId, memberId } = req.params
		const userId = req.user.userId

		// Sprawdź czy użytkownik jest twórcą grupy
		const group = await db.Group.findByPk(groupId)

		if (!group) {
			return res.status(404).json({
				error: 'Grupa nie znaleziona',
			})
		}

		if (group.creator_id !== userId) {
			return res.status(403).json({
				error: 'Tylko twórca grupy może odrzucać prośby',
			})
		}

		// Usuń prośbę o dołączenie
		const deleted = await db.GroupMember.destroy({
			where: {
				group_id: groupId,
				user_id: memberId,
				status: 'pending',
			},
		})

		if (deleted === 0) {
			return res.status(404).json({
				error: 'Prośba o dołączenie nie znaleziona',
			})
		}

		res.json({
			success: true,
			message: 'Prośba odrzucona',
		})
	} catch (error) {
		console.error('❌ Błąd odrzucania prośby:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas odrzucania prośby',
		})
	}
}

/**
 * Usunięcie członka z grupy (tylko twórca)
 */
exports.removeMember = async (req, res) => {
	try {
		const { groupId, memberId } = req.params
		const userId = req.user.userId

		// Sprawdź czy użytkownik jest twórcą grupy
		const group = await db.Group.findByPk(groupId)

		if (!group) {
			return res.status(404).json({
				error: 'Grupa nie znaleziona',
			})
		}

		if (group.creator_id !== userId) {
			return res.status(403).json({
				error: 'Tylko twórca grupy może usuwać członków',
			})
		}

		// Nie można usunąć samego siebie (twórcy)
		if (parseInt(memberId) === userId) {
			return res.status(400).json({
				error: 'Nie możesz usunąć sam siebie. Użyj funkcji usuwania grupy.',
			})
		}

		// Usuń członka
		const deleted = await db.GroupMember.destroy({
			where: {
				group_id: groupId,
				user_id: memberId,
				status: 'accepted',
			},
		})

		if (deleted === 0) {
			return res.status(404).json({
				error: 'Członek nie znaleziony w grupie',
			})
		}

		res.json({
			success: true,
			message: 'Członek usunięty z grupy',
		})
	} catch (error) {
		console.error('❌ Błąd usuwania członka:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas usuwania członka',
		})
	}
}

/**
 * Opuszczenie grupy (każdy członek)
 */
exports.leaveGroup = async (req, res) => {
	try {
		const { groupId } = req.params
		const userId = req.user.userId

		const group = await db.Group.findByPk(groupId)

		if (!group) {
			return res.status(404).json({
				error: 'Grupa nie znaleziona',
			})
		}

		// Twórca nie może opuścić grupy, musi ją usunąć
		if (group.creator_id === userId) {
			return res.status(400).json({
				error: 'Twórca nie może opuścić grupy. Użyj funkcji usuwania grupy zamiast tego.',
			})
		}

		// Usuń użytkownika z grupy
		const deleted = await db.GroupMember.destroy({
			where: {
				group_id: groupId,
				user_id: userId,
			},
		})

		if (deleted === 0) {
			return res.status(404).json({
				error: 'Nie jesteś członkiem tej grupy',
			})
		}

		res.json({
			success: true,
			message: 'Opuściłeś grupę pomyślnie',
		})
	} catch (error) {
		console.error('❌ Błąd opuszczania grupy:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas opuszczania grupy',
		})
	}
}

/**
 * Usunięcie grupy (tylko twórca) - usuwa wszystko łącznie z konwersacją
 */
exports.deleteGroup = async (req, res) => {
	try {
		const { groupId } = req.params
		const userId = req.user.userId

		const group = await db.Group.findByPk(groupId)

		if (!group) {
			return res.status(404).json({
				error: 'Grupa nie znaleziona',
			})
		}

		if (group.creator_id !== userId) {
			return res.status(403).json({
				error: 'Tylko twórca grupy może ją usunąć',
			})
		}

		// Usuń grupę (CASCADE usunie wszystko: członków, konwersację, wiadomości)
		await group.destroy()

		res.json({
			success: true,
			message: 'Grupa usunięta pomyślnie wraz ze wszystkimi wiadomościami',
		})
	} catch (error) {
		console.error('❌ Błąd usuwania grupy:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas usuwania grupy',
		})
	}
}

/**
 * Zmiana nazwy grupy (tylko twórca)
 */
exports.updateGroupName = async (req, res) => {
	try {
		const { groupId } = req.params
		const { groupName } = req.body
		const userId = req.user.userId

		const group = await db.Group.findByPk(groupId)

		if (!group) {
			return res.status(404).json({
				error: 'Grupa nie znaleziona',
			})
		}

		if (group.creator_id !== userId) {
			return res.status(403).json({
				error: 'Tylko twórca grupy może zmieniać jej nazwę',
			})
		}

		await group.update({ group_name: groupName })

		res.json({
			success: true,
			message: 'Nazwa grupy zaktualizowana',
			group: {
				group_id: group.group_id,
				group_name: group.group_name,
			},
		})
	} catch (error) {
		console.error('❌ Błąd zmiany nazwy grupy:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas zmiany nazwy',
		})
	}
}

/**
 * Pobieranie listy grup użytkownika
 */
exports.getUserGroups = async (req, res) => {
	try {
		const userId = req.user.userId

		const memberships = await db.GroupMember.findAll({
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
							model: db.User,
							as: 'creator',
							attributes: ['user_id', 'username'],
						},
						{
							model: db.Conversation,
							as: 'conversation',
							attributes: ['conversation_id'],
						},
					],
				},
			],
			order: [['joined_at', 'DESC']],
		})

		res.json({
			success: true,
			count: memberships.length,
			groups: memberships,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania grup:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania grup',
		})
	}
}

/**
 * Pobieranie oczekujących próśb o dołączenie (dla twórcy grupy)
 */
exports.getPendingRequests = async (req, res) => {
	try {
		const { groupId } = req.params
		const userId = req.user.userId

		// Sprawdź czy użytkownik jest twórcą
		const group = await db.Group.findByPk(groupId)

		if (!group) {
			return res.status(404).json({
				error: 'Grupa nie znaleziona',
			})
		}

		if (group.creator_id !== userId) {
			return res.status(403).json({
				error: 'Tylko twórca może przeglądać oczekujące prośby',
			})
		}

		const pendingRequests = await db.GroupMember.findAll({
			where: {
				group_id: groupId,
				status: 'pending',
			},
			include: [
				{
					model: db.User,
					as: 'user',
					attributes: ['user_id', 'username', 'avatar_url'],
				},
			],
			order: [['member_id', 'ASC']],
		})

		res.json({
			success: true,
			count: pendingRequests.length,
			pendingRequests,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania oczekujących próśb:', error)
		res.status(500).json({
			error: 'Błąd serwera',
		})
	}
}

/**
 * Pobieranie członków grupy
 */
exports.getGroupMembers = async (req, res) => {
	try {
		const { groupId } = req.params
		const userId = req.user.userId

		// Sprawdź czy użytkownik jest członkiem grupy
		const userMembership = await db.GroupMember.findOne({
			where: {
				group_id: groupId,
				user_id: userId,
				status: 'accepted',
			},
		})

		if (!userMembership) {
			return res.status(403).json({
				error: 'Nie jesteś członkiem tej grupy',
			})
		}

		const members = await db.GroupMember.findAll({
			where: {
				group_id: groupId,
				status: 'accepted',
			},
			include: [
				{
					model: db.User,
					as: 'user',
					attributes: ['user_id', 'username', 'avatar_url'],
				},
			],
			order: [
				['role', 'ASC'],
				['joined_at', 'ASC'],
			],
		})

		res.json({
			success: true,
			count: members.length,
			members,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania członków:', error)
		res.status(500).json({
			error: 'Błąd serwera',
		})
	}
}

exports.getGroupDetails = async (req, res) => {
	try {
		const { groupId } = req.params

		const group = await db.Group.findByPk(groupId, {
			include: [
				{
					model: db.User,
					as: 'creator',
					attributes: ['user_id', 'username', 'public_key_dh'],
				},
			],
		})

		if (!group) {
			return res.status(404).json({ error: 'Grupa nie znaleziona' })
		}

		res.json({
			success: true,
			group,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania szczegółów grupy:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

/**
 * Inicjalizuje szyfrowanie grupowe
 * Frontend generuje klucz i wysyła zaszyfrowane kopie dla wszystkich członków
 */
exports.initializeGroupEncryption = async (req, res) => {
	try {
		const { groupId } = req.params
		const { encryptedKeys } = req.body // Array: [{ userId, encryptedKey }, ...]
		const userId = req.user.userId

		console.log('🔐 Inicjalizacja szyfrowania dla grupy:', groupId)
		console.log('   Liczba kluczy:', encryptedKeys?.length)

		// Sprawdź uprawnienia - tylko twórca lub admin może inicjalizować
		const member = await db.GroupMember.findOne({
			where: {
				group_id: groupId,
				user_id: userId,
				status: 'accepted',
			},
		})

		if (!member || (member.role !== 'creator' && member.role !== 'admin')) {
			return res.status(403).json({
				error: 'Tylko twórca lub admin może inicjalizować szyfrowanie',
			})
		}

		// Walidacja danych
		if (!encryptedKeys || !Array.isArray(encryptedKeys) || encryptedKeys.length === 0) {
			return res.status(400).json({
				error: 'Brak zaszyfrowanych kluczy',
			})
		}

		// Sprawdź czy szyfrowanie już istnieje
		const existingKeys = await db.GroupEncryptedKey.findAll({
			where: { group_id: groupId },
		})

		if (existingKeys.length > 0) {
			console.log('⚠️ Szyfrowanie już istnieje - aktualizacja')
			// Usuń stare klucze
			await db.GroupEncryptedKey.destroy({
				where: { group_id: groupId },
			})
		}

		// Zapisz zaszyfrowane klucze dla każdego członka
		const savedKeys = []
		for (const encKey of encryptedKeys) {
			// Walidacja struktury
			if (!encKey.userId || !encKey.encryptedKey) {
				console.warn('⚠️ Nieprawidłowy klucz:', encKey)
				continue
			}

			// Sprawdź czy użytkownik jest członkiem grupy
			const isMember = await db.GroupMember.findOne({
				where: {
					group_id: groupId,
					user_id: encKey.userId,
					status: 'accepted',
				},
			})

			if (!isMember) {
				console.warn(`⚠️ Użytkownik ${encKey.userId} nie jest członkiem grupy`)
				continue
			}

			// Zapisz zaszyfrowany klucz
			await db.GroupEncryptedKey.create({
				group_id: groupId,
				user_id: encKey.userId,
				encrypted_key: encKey.encryptedKey,
			})

			savedKeys.push(encKey.userId)
			console.log(`✅ Klucz zapisany dla użytkownika ${encKey.userId}`)
		}

		console.log(`✅ Szyfrowanie zainicjalizowane dla ${savedKeys.length} członków`)

		res.json({
			success: true,
			message: 'Szyfrowanie grupowe zainicjalizowane',
			keysCount: savedKeys.length,
		})
	} catch (error) {
		console.error('❌ Błąd inicjalizacji szyfrowania:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}

/**
 * Dodaje zaszyfrowany klucz grupowy dla nowego członka
 * Wywoływane z frontendu gdy członek zostanie zaakceptowany
 */
exports.addKeyForMember = async (req, res) => {
	try {
		const { groupId, memberId } = req.params
		const { encryptedKey } = req.body
		const userId = req.user.userId

		console.log(`🔑 Dodawanie klucza dla członka ${memberId} w grupie ${groupId}`)

		// Sprawdź uprawnienia
		const requester = await db.GroupMember.findOne({
			where: {
				group_id: groupId,
				user_id: userId,
				status: 'accepted',
			},
		})

		if (!requester || (requester.role !== 'creator' && requester.role !== 'admin')) {
			return res.status(403).json({ error: 'Brak uprawnień' })
		}

		// Sprawdź czy członek jest w grupie
		const member = await db.GroupMember.findOne({
			where: {
				group_id: groupId,
				user_id: memberId,
				status: 'accepted',
			},
		})

		if (!member) {
			return res.status(404).json({ error: 'Członek nie znaleziony' })
		}

		// Sprawdź czy klucz już istnieje
		const existingKey = await db.GroupEncryptedKey.findOne({
			where: {
				group_id: groupId,
				user_id: memberId,
			},
		})

		if (existingKey) {
			console.log('⚠️ Klucz już istnieje - aktualizacja')
			await existingKey.update({ encrypted_key: encryptedKey })
		} else {
			await db.GroupEncryptedKey.create({
				group_id: groupId,
				user_id: memberId,
				encrypted_key: encryptedKey,
			})
		}

		console.log(`✅ Klucz dodany dla członka ${memberId}`)

		res.json({
			success: true,
			message: 'Klucz grupowy dodany dla członka',
		})
	} catch (error) {
		console.error('❌ Błąd dodawania klucza:', error)
		res.status(500).json({ error: 'Błąd serwera' })
	}
}
