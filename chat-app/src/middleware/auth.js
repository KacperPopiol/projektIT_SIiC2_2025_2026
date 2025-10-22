const jwt = require('jsonwebtoken')

/**
 * Middleware weryfikujący JWT token
 */
const authenticateToken = (req, res, next) => {
	const authHeader = req.headers['authorization']
	const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

	if (!token) {
		return res.status(401).json({
			error: 'Brak tokenu autoryzacyjnego',
		})
	}

	jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
		if (err) {
			return res.status(403).json({
				error: 'Nieprawidłowy lub wygasły token',
			})
		}

		req.user = user
		next()
	})
}

/**
 * Generuje JWT token dla użytkownika
 */
const generateToken = (userId, username) => {
	return jwt.sign({ userId, username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
}

module.exports = {
	authenticateToken,
	generateToken,
}
