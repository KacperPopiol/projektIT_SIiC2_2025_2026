import axiosInstance from './axios'

export const keysApi = {
	// Zapisz klucze publiczny + zaszyfrowany prywatny (backup)
	saveECDHKeys: async (publicKeyJwk, encryptedPrivateKey) => {
		const response = await axiosInstance.post('/keys/ecdh', {
			publicKey: JSON.stringify(publicKeyJwk),
			encryptedPrivateKey,
		})
		return response.data
	},

	// Pobierz klucz publiczny użytkownika
	getPublicKeyDH: async userId => {
		const response = await axiosInstance.get(`/keys/ecdh/public/${userId}`)
		return response.data
	},

	// Pobierz zaszyfrowany klucz prywatny (backup)
	getEncryptedPrivateKeyDH: async () => {
		const response = await axiosInstance.get('/keys/ecdh/private-backup')
		return response.data
	},

	// Pobierz klucze publiczne wszystkich uczestników konwersacji
	getConversationPublicKeys: async conversationId => {
		const response = await axiosInstance.get(`/keys/conversation/${conversationId}/public-keys`)
		return response.data
	},
}
