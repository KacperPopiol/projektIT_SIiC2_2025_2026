import axiosInstance from './axios'

export const keysApi = {
	// Zapisz klucz publiczny i Pre-Keys
	savePublicKey: async (publicKey, preKeys) => {
		const response = await axiosInstance.post('/keys/public-key', {
			publicKey,
			preKeys: preKeys.map(pk => ({ id: pk.id, publicKey: pk.publicKey })),
		})
		return response.data
	},

	// Pobierz klucz publiczny użytkownika
	getPublicKey: async userId => {
		const response = await axiosInstance.get(`/keys/public-key/${userId}`)
		return response.data
	},

	// Pobierz PreKey Bundle
	getPreKeyBundle: async userId => {
		const response = await axiosInstance.get(`/keys/prekey-bundle/${userId}`)
		return response.data
	},

	// Pobierz klucze uczestników konwersacji
	getConversationKeys: async conversationId => {
		const response = await axiosInstance.get(`/keys/conversation/${conversationId}/keys`)
		return response.data
	},
}
