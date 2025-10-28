/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from 'react'
import { storage } from '../utils/storage'
import { authApi } from '../api/authApi'
import { hasPrivateKeyDH, getPrivateKeyDHLocally, importPrivateKeyDH } from '../utils/encryption' // ← DODAJ IMPORT

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null)
	const [token, setToken] = useState(null)
	const [privateKeyDH, setPrivateKeyDH] = useState(null)
	const [loading, setLoading] = useState(true)

	// Sprawdź czy użytkownik jest zalogowany przy starcie
	useEffect(() => {
		const initAuth = async () => {
			console.log('🔐 AuthContext: Initializing...')

			const savedToken = storage.getToken()
			const savedUser = storage.getUser()

			console.log('🔐 Saved token exists:', !!savedToken)
			console.log('🔐 Saved user exists:', !!savedUser)

			if (savedToken && savedUser) {
				console.log('🔐 Restoring session for:', savedUser.username)
				setToken(savedToken)
				setUser(savedUser)

				// ✅ DODAJ: Załaduj klucz prywatny jeśli istnieje
				if (hasPrivateKeyDH()) {
					try {
						console.log('🔑 Loading private key from localStorage...')
						const privateKeyJwk = getPrivateKeyDHLocally()
						const privateKey = await importPrivateKeyDH(privateKeyJwk)
						setPrivateKeyDH(privateKey)
						console.log('🔑 Private key loaded successfully')
					} catch (error) {
						console.error('❌ Error loading private key:', error)
					}
				} else {
					console.log('⚠️ No private key found in localStorage')
				}
			} else {
				console.log('🔐 No saved session found')
			}

			setLoading(false)
			console.log('🔐 AuthContext: Initialized')
		}

		initAuth()
	}, [])

	// Rejestracja
	// const register = async (username, password) => {
	// 	try {
	// 		const data = await authApi.register(username, password)

	// 		storage.setToken(data.token)
	// 		storage.setUser({
	// 			userId: data.userId,
	// 			username: data.username,
	// 		})
	// 		storage.setRecoveryCode(data.recoveryCode)

	// 		setToken(data.token)
	// 		setUser({
	// 			userId: data.userId,
	// 			username: data.username,
	// 		})

	// 		return { success: true, data }
	// 	} catch (error) {
	// 		return {
	// 			success: false,
	// 			error: error.response?.data?.error || 'Błąd rejestracji',
	// 		}
	// 	}
	// }

	const register = async (username, password) => {
		try {
			console.log('🔐 Registering user:', username)
			const data = await authApi.register(username, password)

			console.log('🔐 Register response:', data)

			storage.setToken(data.token)
			storage.setUser({
				userId: data.userId,
				username: data.username,
			})
			storage.setRecoveryCode(data.recoveryCode)
			console.log('🔐 Registration data saved to localStorage')

			setToken(data.token)
			setUser({
				userId: data.userId,
				username: data.username,
			})

			// Weryfikuj
			const savedToken = localStorage.getItem('token')
			console.log('🔐 Verification - Token saved:', !!savedToken)

			return { success: true, data, password }
		} catch (error) {
			console.error('🔐 Register error:', error)
			return {
				success: false,
				error: error.response?.data?.error || 'Błąd rejestracji',
			}
		}
	}

	// Logowanie
	// const login = async (username, password) => {
	// 	try {
	// 		const data = await authApi.login(username, password)

	// 		storage.setToken(data.token)
	// 		storage.setUser({
	// 			userId: data.userId,
	// 			username: data.username,
	// 			avatarUrl: data.avatarUrl,
	// 		})

	// 		setToken(data.token)
	// 		setUser({
	// 			userId: data.userId,
	// 			username: data.username,
	// 			avatarUrl: data.avatarUrl,
	// 		})

	// 		return { success: true, data }
	// 	} catch (error) {
	// 		return {
	// 			success: false,
	// 			error: error.response?.data?.error || 'Błąd logowania',
	// 		}
	// 	}
	// }
	const login = async (username, password) => {
		try {
			console.log('🔐 Logging in user:', username)
			const data = await authApi.login(username, password)

			console.log('🔐 Login response:', data)
			console.log('🔐 Token received:', data.token ? 'YES' : 'NO')

			// Zapisz token
			storage.setToken(data.token)
			console.log('🔐 Token saved to localStorage')

			// Zapisz user
			const userData = {
				userId: data.userId,
				username: data.username,
				avatarUrl: data.avatarUrl,
			}
			storage.setUser(userData)
			console.log('🔐 User saved to localStorage:', userData)

			// Ustaw w state
			setToken(data.token)
			setUser(userData)
			console.log('🔐 State updated')

			// Weryfikuj że zapisało się
			const savedToken = localStorage.getItem('token')
			const savedUser = localStorage.getItem('user')
			console.log('🔐 Verification - Token in localStorage:', !!savedToken)
			console.log('🔐 Verification - User in localStorage:', !!savedUser)

			return { success: true, data, password }
		} catch (error) {
			console.error('🔐 Login error:', error)
			return {
				success: false,
				error: error.response?.data?.error || 'Błąd logowania',
			}
		}
	}

	// Wylogowanie
	const logout = () => {
		storage.clearAll()
		setToken(null)
		setUser(null)
		setPrivateKeyDH(null)
	}

	// Odświeżenie danych użytkownika
	const refreshUser = async () => {
		try {
			const data = await authApi.getProfile()
			const updatedUser = {
				userId: data.user.user_id,
				username: data.user.username,
				avatarUrl: data.user.avatar_url,
			}
			storage.setUser(updatedUser)
			setUser(updatedUser)
		} catch (error) {
			console.error('Błąd odświeżania profilu:', error)
		}
	}

	const value = {
		user,
		token,
		privateKeyDH,
		setPrivateKeyDH,
		loading,
		isAuthenticated: !!token,
		register,
		login,
		logout,
		refreshUser,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
