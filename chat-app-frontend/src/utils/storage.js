// Zarządzanie localStorage

export const storage = {
	// Token
	setToken: token => {
		console.log('💾 STORAGE: Setting token:', token ? 'YES' : 'NO')
		localStorage.setItem('token', token)
		console.log('💾 STORAGE: Token set, verifying:', localStorage.getItem('token') ? 'SUCCESS' : 'FAILED')
	},

	getToken: () => {
		const token = localStorage.getItem('token')
		console.log('💾 STORAGE: Getting token:', token ? 'FOUND' : 'NOT FOUND')
		return token
	},

	removeToken: () => {
		localStorage.removeItem('token')
	},

	// User data
	setUser: user => {
		localStorage.setItem('user', JSON.stringify(user))
	},

	getUser: () => {
		const user = localStorage.getItem('user')
		return user ? JSON.parse(user) : null
	},

	removeUser: () => {
		localStorage.removeItem('user')
	},

	// Recovery code (tymczasowo po rejestracji)
	setRecoveryCode: code => {
		localStorage.setItem('recoveryCode', code)
	},

	getRecoveryCode: () => {
		return localStorage.getItem('recoveryCode')
	},

	removeRecoveryCode: () => {
		localStorage.removeItem('recoveryCode')
	},

	// Clear all
	clearAll: () => {
		localStorage.clear()
	},

	// Notification settings (cache)
	setNotificationSettings: settings => {
		localStorage.setItem('notificationSettings', JSON.stringify(settings))
	},

	getNotificationSettings: () => {
		const settings = localStorage.getItem('notificationSettings')
		return settings ? JSON.parse(settings) : null
	},

	removeNotificationSettings: () => {
		localStorage.removeItem('notificationSettings')
	},

	// Theme preference
	setThemePreference: theme => {
		localStorage.setItem('themePreference', theme)
	},

	getThemePreference: () => {
		return localStorage.getItem('themePreference')
	},

	removeThemePreference: () => {
		localStorage.removeItem('themePreference')
	},
}
