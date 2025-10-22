import axiosInstance from './axios'

export const messagesApi = {
	// Lista konwersacji
	getConversations: async (includeArchived = false) => {
		const response = await axiosInstance.get(`/messages/conversations?includeArchived=${includeArchived}`)
		return response.data
	},

	// Historia wiadomości
	getMessages: async (conversationId, limit = 50, offset = 0) => {
		const response = await axiosInstance.get(
			`/messages/conversations/${conversationId}?limit=${limit}&offset=${offset}`
		)
		return response.data
	},

	// Eksport konwersacji
	exportConversation: async conversationId => {
		const response = await axiosInstance.get(`/messages/conversations/${conversationId}/export`)
		return response.data
	},

	// Archiwizacja konwersacji
	archiveConversation: async conversationId => {
		const response = await axiosInstance.post(`/messages/conversations/${conversationId}/archive`)
		return response.data
	},

	// Przywrócenie z archiwum
	unarchiveConversation: async conversationId => {
		const response = await axiosInstance.post(`/messages/conversations/${conversationId}/unarchive`)
		return response.data
	},

	// Usunięcie konwersacji
	deleteChat: async conversationId => {
		const response = await axiosInstance.delete(`/messages/conversations/${conversationId}`)
		return response.data
	},

	// Usunięcie pojedynczej wiadomości
	deleteMessage: async messageId => {
		const response = await axiosInstance.delete(`/messages/${messageId}`)
		return response.data
	},
}
