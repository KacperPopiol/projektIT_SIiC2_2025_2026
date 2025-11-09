import axiosInstance from './axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

/**
 * API client dla plików
 */
export const filesApi = {
	/**
	 * Upload plików do konwersacji
	 * @param {number} conversationId - ID konwersacji
	 * @param {File[]} files - Tablica plików do przesłania
	 * @param {Function} onProgress - Callback do śledzenia postępu (progress: number) => void
	 * @returns {Promise<{success: boolean, files: Array}>}
	 */
	uploadFiles: async (conversationId, files, onProgress = null) => {
		const formData = new FormData()
		formData.append('conversationId', conversationId.toString())

		// Dodaj wszystkie pliki do FormData
		for (const file of files) {
			formData.append('files', file)
		}

		const config = {
			headers: {
				'Content-Type': 'multipart/form-data',
			},
			timeout: 300000, // 5 minut timeout dla dużych plików
			onUploadProgress: progressEvent => {
				if (onProgress && progressEvent.total) {
					const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
					onProgress(progress)
				}
			},
		}

		const response = await axiosInstance.post('/files/upload', formData, config)
		return response.data
	},

	/**
	 * Pobiera plik jako blob URL (token jest dodawany przez axios interceptor)
	 * @param {number} fileId - ID pliku
	 * @returns {Promise<string>} - Blob URL do pliku
	 */
	getFileUrl: async fileId => {
		const response = await axiosInstance.get(`/files/${fileId}`, {
			responseType: 'blob',
		})
		return URL.createObjectURL(response.data)
	},

	/**
	 * Pobiera miniaturę jako blob URL (token jest dodawany przez axios interceptor)
	 * @param {number} fileId - ID pliku
	 * @returns {Promise<string>} - Blob URL do miniatury
	 */
	getFileThumbnailUrl: async fileId => {
		const response = await axiosInstance.get(`/files/${fileId}/thumbnail`, {
			responseType: 'blob',
		})
		return URL.createObjectURL(response.data)
	},

	/**
	 * Usuwa plik
	 * @param {number} fileId - ID pliku
	 * @returns {Promise<{success: boolean}>}
	 */
	deleteFile: async fileId => {
		const response = await axiosInstance.delete(`/files/${fileId}`)
		return response.data
	},

	/**
	 * Formatuje rozmiar pliku do czytelnej postaci
	 * @param {number} bytes - Rozmiar w bajtach
	 * @returns {string} - Sformatowany rozmiar (np. "1.5 MB")
	 */
	formatFileSize: bytes => {
		if (bytes === 0) return '0 Bytes'
		const k = 1024
		const sizes = ['Bytes', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
	},
}

