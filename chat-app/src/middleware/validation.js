const { body, validationResult } = require('express-validator')

/**
 * Walidacja rejestracji użytkownika
 */
const validateRegistration = [
	body('username')
		.trim()
		.isLength({ min: 3, max: 100 })
		.withMessage('Nazwa użytkownika musi mieć od 3 do 100 znaków')
		.matches(/^[a-zA-Z0-9_]+$/)
		.withMessage('Nazwa użytkownika może zawierać tylko litery, cyfry i podkreślenia'),

	body('password').isLength({ min: 6 }).withMessage('Hasło musi mieć minimum 6 znaków'),

	(req, res, next) => {
		const errors = validationResult(req)
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}
		next()
	},
]

/**
 * Walidacja logowania
 */
const validateLogin = [
	body('username').trim().notEmpty().withMessage('Nazwa użytkownika jest wymagana'),

	body('password').notEmpty().withMessage('Hasło jest wymagane'),

	(req, res, next) => {
		const errors = validationResult(req)
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}
		next()
	},
]

/**
 * Walidacja kodu zaproszeniowego
 */
const validateInviteCode = [
	body('inviteCode')
		.trim()
		.isLength({ min: 6, max: 6 })
		.withMessage('Kod zaproszeniowy musi mieć 6 znaków')
		.isAlphanumeric()
		.withMessage('Kod zaproszeniowy może zawierać tylko litery i cyfry'),

	(req, res, next) => {
		const errors = validationResult(req)
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}
		next()
	},
]

/**
 * Walidacja nazwy grupy
 */
const validateGroupName = [
	body('groupName')
		.trim()
		.isLength({ min: 3, max: 255 })
		.withMessage('Nazwa grupy musi mieć od 3 do 255 znaków')
		.notEmpty()
		.withMessage('Nazwa grupy jest wymagana'),

	(req, res, next) => {
		const errors = validationResult(req)
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}
		next()
	},
]

/**
 * Walidacja wiadomości
 */
const validateMessage = [
	body('content')
		.trim()
		.notEmpty()
		.withMessage('Treść wiadomości jest wymagana')
		.isLength({ max: 5000 })
		.withMessage('Wiadomość nie może przekraczać 5000 znaków'),

	(req, res, next) => {
		const errors = validationResult(req)
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() })
		}
		next()
	},
]

module.exports = {
	validateRegistration,
	validateLogin,
	validateInviteCode,
	validateGroupName,
	validateMessage,
}
