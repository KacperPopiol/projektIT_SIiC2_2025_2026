/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useContext } from 'react'
import { io } from 'socket.io-client'
import { AuthContext } from './AuthContext'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

export const SocketContext = createContext()

export const SocketProvider = ({ children }) => {
	const [socket, setSocket] = useState(null)
	const [connected, setConnected] = useState(false)
	const { token, isAuthenticated, loading } = useContext(AuthContext)

	useEffect(() => {
		// Poczekaj aż AuthContext się załaduje
		if (loading) {
			console.log('⏳ Waiting for auth to load...')
			return
		}

		// DODAJ MAŁE OPÓŹNIENIE aby upewnić się że token jest dostępny
		const connectTimer = setTimeout(() => {
			// Połącz tylko jeśli użytkownik jest zalogowany i ma token
			if (isAuthenticated && token) {
				console.log('🔌 Connecting to Socket.io with token...')
				console.log('Token preview:', token.substring(0, 20) + '...')

				const newSocket = io(SOCKET_URL, {
					auth: {
						token: token,
					},
					transports: ['websocket', 'polling'],
					reconnection: true,
					reconnectionAttempts: 5,
					reconnectionDelay: 1000,
				})

				// Event: Połączono
				newSocket.on('connect', () => {
					console.log('✅ Connected to Socket.io - ID:', newSocket.id)
					setConnected(true)
					newSocket.emit('user_online')
				})

				// Event: Rozłączono
				newSocket.on('disconnect', reason => {
					console.log('❌ Disconnected from Socket.io. Reason:', reason)
					setConnected(false)
				})

				// Event: Błąd połączenia
				newSocket.on('connect_error', error => {
					console.error('❌ Socket connection error:', error.message)
					setConnected(false)
				})

				setSocket(newSocket)
			} else {
				console.log('⚠️ Not authenticated, skipping Socket.io connection')
				console.log('Debug:', { isAuthenticated, hasToken: !!token })

				// Rozłącz istniejące połączenie jeśli użytkownik się wylogował
				if (socket) {
					console.log('🔌 Disconnecting existing socket...')
					socket.disconnect()
					setSocket(null)
					setConnected(false)
				}
			}
		}, 100) // Czekaj 100ms

		// Cleanup
		return () => {
			clearTimeout(connectTimer)
			if (socket) {
				console.log('🔌 Cleaning up Socket.io connection...')
				socket.disconnect()
			}
		}
	}, [isAuthenticated, token, loading])

	const value = {
		socket,
		connected,
	}

	return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
