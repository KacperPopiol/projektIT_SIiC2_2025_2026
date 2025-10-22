const crypto = require('crypto')

/**
 * Generuje losowy kod zaproszeniowy
 * @param {number} length - Długość kodu (domyślnie 6)
 * @returns {string} - Wygenerowany kod
 */
const generateInviteCode = (length = 6) => {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
	let code = ''

	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(Math.random() * chars.length)
		code += chars[randomIndex]
	}

	return code
}

/**
 * Generuje unikalny kod odzyskiwania konta
 * @returns {string} - 64-znakowy hash
 */
const generateRecoveryCode = () => {
	return crypto.randomBytes(32).toString('hex')
}

/**
 * Sprawdza czy kod zaproszeniowy jest ważny (nie wygasł)
 * @param {Date} expiresAt - Data wygaśnięcia
 * @returns {boolean} - Czy kod jest ważny
 */
const isCodeValid = expiresAt => {
	return new Date() < new Date(expiresAt)
}

/**
 * Tworzy datę wygaśnięcia (60 sekund od teraz)
 * @returns {Date} - Data wygaśnięcia
 */
const getExpirationDate = () => {
	return new Date(Date.now() + 60000) // 60 sekund
}

module.exports = {
	generateInviteCode,
	generateRecoveryCode,
	isCodeValid,
	getExpirationDate,
}
