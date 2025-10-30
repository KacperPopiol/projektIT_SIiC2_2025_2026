/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from 'react'
import { storage } from '../utils/storage'
import { authApi } from '../api/authApi'
import { hasPrivateKeyDH, getPrivateKeyDHLocally, importPrivateKeyDH } from '../utils/encryption'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null)
	const [token, setToken] = useState(null)
	const [privateKeyDH, setPrivateKeyDH] = useState(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const initAuth = async () => {
			const savedToken = storage.getToken()
			const savedUser = storage.getUser()

			if (savedToken && savedUser) {
				setToken(savedToken)
				setUser(savedUser)

				if (hasPrivateKeyDH()) {
					try {
						const privateKeyJwk = getPrivateKeyDHLocally()
						const privateKey = await importPrivateKeyDH(privateKeyJwk)
						setPrivateKeyDH(privateKey)
					} catch (error) {
						console.error('Error loading private key:', error)
					}
				} else {
					console.log('No private key found in localStorage')
				}
			} else {
				console.log('No saved session found')
			}

			setLoading(false)
			console.log('AuthContext: Initialized')
		}

		initAuth()
	}, [])

	const register = async (username, password) => {
		try {
			const data = await authApi.register(username, password)

			storage.setToken(data.token)
			storage.setUser({
				userId: data.userId,
				username: data.username,
			})
			storage.setRecoveryCode(data.recoveryCode)

			setToken(data.token)
			setUser({
				userId: data.userId,
				username: data.username,
			})

			return { success: true, data, password }
		} catch (error) {
			console.error('Register error:', error)
			return {
				success: false,
				error: error.response?.data?.error || 'Błąd rejestracji',
			}
		}
	}

	const login = async (username, password) => {
		try {
			const data = await authApi.login(username, password)
			storage.setToken(data.token)

			const userData = {
				userId: data.userId,
				username: data.username,
				avatarUrl: data.avatarUrl,
			}
			storage.setUser(userData)

			setToken(data.token)
			setUser(userData)
			return { success: true, data, password }
		} catch (error) {
			return {
				success: false,
				error: error.response?.data?.error || 'Błąd logowania',
			}
		}
	}

	const logout = () => {
		storage.clearAll()
		setToken(null)
		setUser(null)
		setPrivateKeyDH(null)
	}

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
