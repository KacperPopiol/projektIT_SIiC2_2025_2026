import axios from 'axios'
import { storage } from '../utils/storage'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Główna instancja axios
const axiosInstance = axios.create({
	baseURL: API_URL,
	headers: {
		'Content-Type': 'application/json',
	},
	timeout: 30000, // 30 sekund domyślny timeout (dla uploadów używamy większego w filesApi)
})

// Interceptor - automatycznie dodaje token do każdego requesta
axiosInstance.interceptors.request.use(
	config => {
		const token = storage.getToken()
		if (token) {
			config.headers.Authorization = `Bearer ${token}`
		}
		return config
	},
	error => {
		return Promise.reject(error)
	}
)

// Interceptor - obsługa błędów (np. wygasły token)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // ✅ Wyloguj TYLKO przy 401 (Unauthorized - zły token)
    // NIE wylogowuj przy 403 (Forbidden - brak uprawnień)
    if (error.response?.status === 401) {
      console.log('❌ Token wygasł - wylogowanie');
      storage.clearAll();
      window.location.href = '/login';
    }
    
    // Przy 403 tylko pokaż błąd w konsoli
    if (error.response?.status === 403) {
      console.log('⚠️ Brak uprawnień do tej akcji');
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance
