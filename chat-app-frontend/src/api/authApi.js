import axiosInstance from './axios'

export const authApi = {
	// Rejestracja
	register: async (username, password) => {
		const response = await axiosInstance.post('/auth/register', {
			username,
			password,
		})
		return response.data
	},

	// Logowanie
	login: async (username, password) => {
		const response = await axiosInstance.post('/auth/login', {
			username,
			password,
		})
		return response.data
	},

	// Odzyskiwanie konta
	recoverAccount: async (username, recoveryCode, newPassword) => {
		const response = await axiosInstance.post('/auth/recover', {
			username,
			recoveryCode,
			newPassword,
		})
		return response.data
	},

	// Pobranie profilu
	getProfile: async () => {
		const response = await axiosInstance.get('/auth/profile')
		return response.data
	},

	// Zmiana awatara
	updateAvatar: async avatarUrl => {
		const response = await axiosInstance.put('/auth/avatar', {
			avatarUrl,
		})
		return response.data
	},

	// Usunięcie konta
	deleteAccount: async () => {
		const response = await axiosInstance.delete('/auth/account')
		return response.data
	},
}
