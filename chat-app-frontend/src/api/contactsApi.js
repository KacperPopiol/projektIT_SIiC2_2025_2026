import axiosInstance from './axios'

export const contactsApi = {
	// Generowanie kodu zaproszeniowego
	generateInviteCode: async () => {
		const response = await axiosInstance.post('/contacts/generate-code')
		return response.data
	},

	// Wysłanie zaproszenia
	sendInvitation: async inviteCode => {
		const response = await axiosInstance.post('/contacts/invite', {
			inviteCode,
		})
		return response.data
	},

	// Akceptacja zaproszenia
	acceptInvitation: async contactId => {
		const response = await axiosInstance.post(`/contacts/${contactId}/accept`)
		return response.data
	},

	// Odrzucenie zaproszenia
	rejectInvitation: async contactId => {
		const response = await axiosInstance.delete(`/contacts/${contactId}/reject`)
		return response.data
	},

	// Lista znajomych
	getContacts: async () => {
		const response = await axiosInstance.get('/contacts')
		return response.data
	},

	// Otrzymane zaproszenia
	getPendingInvitations: async () => {
		const response = await axiosInstance.get('/contacts/pending')
		return response.data
	},

	// Wysłane zaproszenia
	getSentInvitations: async () => {
		const response = await axiosInstance.get('/contacts/sent')
		return response.data
	},

	// Wyszukiwanie znajomego
	searchContact: async username => {
		const response = await axiosInstance.get(`/contacts/search?username=${username}`)
		return response.data
	},
}
