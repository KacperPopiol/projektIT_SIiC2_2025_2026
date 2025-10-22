const bcrypt = require('bcryptjs')
const db = require('../models')
const { generateToken } = require('../middleware/auth')
const { generateRecoveryCode } = require('../utils/generateCode')

/**
 * Rejestracja nowego użytkownika (anonimowa)
 */
exports.register = async (req, res) => {
	
	try {
		const { username, password } = req.body

		// Sprawdź czy użytkownik już istnieje
		const existingUser = await db.User.findOne({
			where: { username },
		})

		if (existingUser) {
			return res.status(400).json({
				error: 'Użytkownik o takiej nazwie już istnieje',
			})
		}

		// Hashuj hasło
		const password_hash = await bcrypt.hash(password, 10)

		// Generuj unikalny kod odzyskiwania konta
		const recovery_code = generateRecoveryCode()

		// Utwórz użytkownika
		const user = await db.User.create({
			username,
			password_hash,
			recovery_code,
		})

		// Generuj JWT token
		const token = generateToken(user.user_id, user.username)

		res.status(201).json({
			success: true,
			message: 'Użytkownik zarejestrowany pomyślnie',
			userId: user.user_id,
			username: user.username,
			recoveryCode: recovery_code,
			token,
		})
	} catch (error) {
		console.error('❌ Błąd rejestracji:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas rejestracji',
		})
	}
}

/**
 * Logowanie użytkownika (anonimowe)
 */
exports.login = async (req, res) => {
	try {
		const { username, password } = req.body

		// Znajdź użytkownika po nazwie
		const user = await db.User.findOne({
			where: { username },
		})

		if (!user) {
			return res.status(401).json({
				error: 'Nieprawidłowa nazwa użytkownika lub hasło',
			})
		}

		// Sprawdź czy konto nie jest zablokowane
		if (user.account_locked) {
			return res.status(403).json({
				error:
					'Konto zostało zablokowane po 5 nieudanych próbach logowania. Użyj kodu odzyskiwania aby odblokować konto i zmienić hasło.',
			})
		}

		// Sprawdź poprawność hasła
		const isPasswordValid = await bcrypt.compare(password, user.password_hash)

		if (!isPasswordValid) {
			// Zwiększ licznik nieudanych prób logowania
			await user.increment('failed_login_attempts')
			await user.reload()

			// Zablokuj konto po 5 nieudanych próbach
			if (user.failed_login_attempts >= 5) {
				await user.update({ account_locked: true })
				return res.status(403).json({
					error:
						'Konto zostało zablokowane z powodu 5 nieudanych prób logowania. Użyj kodu odzyskiwania aby odblokować konto.',
				})
			}

			return res.status(401).json({
				error: 'Nieprawidłowa nazwa użytkownika lub hasło',
				remainingAttempts: 5 - user.failed_login_attempts,
			})
		}

		// Resetuj licznik nieudanych prób przy poprawnym logowaniu
		if (user.failed_login_attempts > 0) {
			await user.update({ failed_login_attempts: 0 })
		}

		// Generuj JWT token
		const token = generateToken(user.user_id, user.username)

		res.json({
			success: true,
			message: 'Zalogowano pomyślnie',
			userId: user.user_id,
			username: user.username,
			avatarUrl: user.avatar_url,
			token,
		})
	} catch (error) {
		console.error('❌ Błąd logowania:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas logowania',
		})
	}
}

/**
 * Odzyskiwanie konta i zmiana hasła przy użyciu kodu odzyskiwania
 */
exports.recoverAccount = async (req, res) => {
	try {
		const { username, recoveryCode, newPassword } = req.body

		// Walidacja danych wejściowych
		if (!username || !recoveryCode || !newPassword) {
			return res.status(400).json({
				error: 'Wszystkie pola są wymagane: username, recoveryCode, newPassword',
			})
		}

		if (newPassword.length < 6) {
			return res.status(400).json({
				error: 'Nowe hasło musi mieć minimum 6 znaków',
			})
		}

		// Znajdź użytkownika po nazwie i kodzie odzyskiwania
		const user = await db.User.findOne({
			where: {
				username,
				recovery_code: recoveryCode,
			},
		})

		if (!user) {
			return res.status(404).json({
				error: 'Nieprawidłowy kod odzyskiwania lub nazwa użytkownika',
			})
		}

		// Hashuj nowe hasło
		const password_hash = await bcrypt.hash(newPassword, 10)

		// Aktualizuj użytkownika - zmień hasło, odblokuj konto i zresetuj licznik
		await user.update({
			password_hash,
			failed_login_attempts: 0,
			account_locked: false,
		})

		res.json({
			success: true,
			message: 'Hasło zostało zmienione pomyślnie i konto zostało odblokowane',
		})
	} catch (error) {
		console.error('❌ Błąd odzyskiwania konta:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas odzyskiwania konta',
		})
	}
}

/**
 * Usunięcie konta użytkownika
 */
exports.deleteAccount = async (req, res) => {
	try {
		const userId = req.user.userId

		// Znajdź użytkownika
		const user = await db.User.findByPk(userId)

		if (!user) {
			return res.status(404).json({
				error: 'Użytkownik nie znaleziony',
			})
		}

		// Usuń użytkownika (CASCADE usunie wszystkie powiązane dane)
		await user.destroy()

		res.json({
			success: true,
			message: 'Konto zostało usunięte pomyślnie wraz ze wszystkimi danymi',
		})
	} catch (error) {
		console.error('❌ Błąd usuwania konta:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas usuwania konta',
		})
	}
}

/**
 * Pobieranie informacji o zalogowanym użytkowniku
 */
exports.getProfile = async (req, res) => {
	try {
		const userId = req.user.userId

		const user = await db.User.findByPk(userId, {
			attributes: ['user_id', 'username', 'avatar_url', 'created_at'],
		})

		if (!user) {
			return res.status(404).json({
				error: 'Użytkownik nie znaleziony',
			})
		}

		res.json({
			success: true,
			user,
		})
	} catch (error) {
		console.error('❌ Błąd pobierania profilu:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas pobierania profilu',
		})
	}
}

/**
 * Zmiana awatara użytkownika
 */
exports.updateAvatar = async (req, res) => {
	try {
		const userId = req.user.userId
		const { avatarUrl } = req.body

		if (!avatarUrl) {
			return res.status(400).json({
				error: 'URL awatara jest wymagany',
			})
		}

		const user = await db.User.findByPk(userId)

		if (!user) {
			return res.status(404).json({
				error: 'Użytkownik nie znaleziony',
			})
		}

		await user.update({ avatar_url: avatarUrl })

		res.json({
			success: true,
			message: 'Awatar zaktualizowany pomyślnie',
			avatarUrl: user.avatar_url,
		})
	} catch (error) {
		console.error('❌ Błąd aktualizacji awatara:', error)
		res.status(500).json({
			error: 'Błąd serwera podczas aktualizacji awatara',
		})
	}
}
