import { useState, useEffect } from 'react'
import { messagesApi } from '../../api/messagesApi'
import { usersApi } from '../../api/usersApi'
import { useSocket } from '../../hooks/useSocket'
import { useAuth } from '../../hooks/useAuth'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import DisappearingMessagesBanner from './DisappearingMessagesBanner'
import { keysApi } from '../../api/keysApi'

const ChatWindow = ({ conversation }) => {
	const [messages, setMessages] = useState([])
	const [loading, setLoading] = useState(true)
	const [typingUsers, setTypingUsers] = useState([])
	const [showMenu, setShowMenu] = useState(false)
	const [menuLoading, setMenuLoading] = useState(false)
	const [disappearingMessagesEnabled, setDisappearingMessagesEnabled] = useState(false)
	const [disappearingMessagesEnabledAt, setDisappearingMessagesEnabledAt] = useState(null)
	const [disappearingTime, setDisappearingTime] = useState(null) // Czas znikania użytkownika który włączył tryb
	const { socket, connected } = useSocket()
	const { user } = useAuth()

	// Ładowanie wiadomości i ustawień konwersacji przy zmianie konwersacji
	useEffect(() => {
		loadMessages()
		loadConversationSettings()
	}, [conversation.conversationId])

	// Socket.io - dołączanie do pokoju i nasłuchiwanie na eventy
	useEffect(() => {
		if (!socket || !connected) return

		console.log('🔌 Setting up socket listeners for conversation:', conversation.conversationId)

		// Dołączenie do pokoju konwersacji
		if (conversation.type === 'private') {
			socket.emit('join_conversation', { conversationId: conversation.conversationId })
		} else {
			socket.emit('join_group', { groupId: conversation.groupId })
		}

		// Nasłuchiwanie na nowe wiadomości prywatne
		const handleNewPrivateMessage = data => {
			if (data.conversationId === conversation.conversationId) {
				setMessages(prev => [
					...prev,
					{
						message_id: data.messageId,
						conversation_id: data.conversationId,
						sender_id: data.senderId,
						content: data.content,
						is_encrypted: data.isEncrypted,
						created_at: data.createdAt,
						sender: {
							username: data.senderUsername,
						},
						readStatuses: [],
						files: data.files || [], // Dodaj pliki z socket event
					},
				])
			}
		}

		// Nasłuchiwanie na nowe wiadomości grupowe
		const handleNewGroupMessage = data => {
			console.log('📨 New group message received:', data)
			if (data.conversationId === conversation.conversationId) {
				setMessages(prev => [
					...prev,
					{
						message_id: data.messageId,
						conversation_id: data.conversationId,
						sender_id: data.senderId,
						content: data.content,
						is_encrypted: data.isEncrypted,
						created_at: data.createdAt,
						sender: {
							username: data.senderUsername,
						},
						readStatuses: [],
						files: data.files || [], // Dodaj pliki z socket event
					},
				])
			}
		}

		// Nasłuchiwanie na statusy odczytania
		const handleMessageRead = data => {
			console.log('✅ Message read:', data)
			setMessages(prev =>
				prev.map(msg => {
					if (msg.message_id === data.messageId) {
						// Zaktualizuj istniejący status odczytania lub dodaj nowy
						const existingStatusIndex = (msg.readStatuses || []).findIndex(
							s => s.user_id === data.readBy
						)
						const newStatus = {
							user_id: data.readBy,
							is_read: true,
							read_at: data.readAt,
							delete_at: data.deleteAt || null,
						}
						if (existingStatusIndex >= 0) {
							const updatedStatuses = [...(msg.readStatuses || [])]
							updatedStatuses[existingStatusIndex] = newStatus
							return {
								...msg,
								readStatuses: updatedStatuses,
							}
						} else {
							return {
								...msg,
								readStatuses: [...(msg.readStatuses || []), newStatus],
							}
						}
					}
					return msg
				})
			)
		}

		// Nasłuchiwanie na wskaźnik pisania
		const handleUserTyping = data => {
			if (data.conversationId === conversation.conversationId && data.userId !== user?.userId) {
				setTypingUsers(prev => {
					if (!prev.find(u => u.userId === data.userId)) {
						return [...prev, { userId: data.userId, username: data.username }]
					}
					return prev
				})
			}
		}

		// Nasłuchiwanie na przestanie pisanie
		const handleUserStopTyping = data => {
			if (data.conversationId === conversation.conversationId) {
				setTypingUsers(prev => prev.filter(u => u.userId !== data.userId))
			}
		}

		// Nasłuchiwanie na przełączenie trybu znikających wiadomości
		const handleDisappearingMessagesToggled = data => {
			if (data.conversationId === conversation.conversationId) {
				setDisappearingMessagesEnabled(data.enabled)
				setDisappearingMessagesEnabledAt(data.enabledAt || null)
				// Użyj czasu znikania użytkownika który włączył tryb
				if (data.enabled && data.disappearingTime) {
					setDisappearingTime(data.disappearingTime)
				} else {
					setDisappearingTime(null)
				}
			}
		}

		// Nasłuchiwanie na zniknięcie wiadomości (z schedulera)
		const handleMessageDisappeared = data => {
			console.log('🗑️ Message disappeared:', data)
			// Usuń wiadomość z lokalnego stanu (scheduler usunął z bazy)
			setMessages(prev => prev.filter(msg => msg.message_id !== data.messageId))
		}

		// Listenery
		socket.on('new_private_message', handleNewPrivateMessage)
		socket.on('new_group_message', handleNewGroupMessage)
		socket.on('message_read', handleMessageRead)
		socket.on('user_typing', handleUserTyping)
		socket.on('user_stop_typing', handleUserStopTyping)
		socket.on('disappearing_messages_toggled', handleDisappearingMessagesToggled)
		socket.on('message_disappeared', handleMessageDisappeared)

		// Cleanup - usunięcie listenerów i opuszczenie pokoju
		return () => {
			console.log('🔌 Cleaning up socket listeners')
			socket.off('new_private_message', handleNewPrivateMessage)
			socket.off('new_group_message', handleNewGroupMessage)
			socket.off('message_read', handleMessageRead)
			socket.off('user_typing', handleUserTyping)
			socket.off('user_stop_typing', handleUserStopTyping)
			socket.off('disappearing_messages_toggled', handleDisappearingMessagesToggled)
			socket.off('message_disappeared', handleMessageDisappeared)

			if (conversation.type === 'private') {
				socket.emit('leave_conversation', { conversationId: conversation.conversationId })
			} else {
				socket.emit('leave_group', { groupId: conversation.groupId })
			}
		}
	}, [socket, connected, conversation, user])

	// Automatyczne oznaczanie wiadomości jako przeczytane
	useEffect(() => {
		if (!socket || !connected || messages.length === 0) return

		// Oznaczenie wszystkich nieprzeczytanych wiadomości jako przeczytane
		messages.forEach(message => {
			if (message.sender_id !== user?.userId) {
				const isRead = message.readStatuses?.some(s => s.user_id === user?.userId && s.is_read)
				if (!isRead) {
					socket.emit('mark_message_read', { messageId: message.message_id })
				}
			}
		})
	}, [messages, socket, connected, user])

	useEffect(() => {
		const handleClickOutside = event => {
			if (showMenu && !event.target.closest('button')) {
				setShowMenu(false)
			}
		}

		document.addEventListener('click', handleClickOutside)
		return () => document.removeEventListener('click', handleClickOutside)
	}, [showMenu])

	// Ładowanie wiadomości
	const loadMessages = async () => {
		try {
			setLoading(true)
			const response = await messagesApi.getMessages(conversation.conversationId)
			setMessages(response.messages || [])
		} catch (error) {
			console.error('Błąd ładowania wiadomości:', error)
		} finally {
			setLoading(false)
		}
	}

	// Ładowanie ustawień konwersacji
	const loadConversationSettings = async () => {
		try {
			const response = await messagesApi.getConversationSettings(conversation.conversationId)
			if (response.success && response.settings) {
				setDisappearingMessagesEnabled(response.settings.disappearing_messages_enabled || false)
				setDisappearingMessagesEnabledAt(response.settings.disappearing_messages_enabled_at || null)
				// Użyj czasu znikania użytkownika który włączył tryb (jeśli tryb włączony)
				if (response.settings.disappearing_messages_enabled && response.settings.disappearing_time) {
					setDisappearingTime(response.settings.disappearing_time)
				} else {
					setDisappearingTime(null)
				}
			}
		} catch (error) {
			console.error('Błąd ładowania ustawień konwersacji:', error)
		}
	}

	// Przełączanie trybu znikających wiadomości
	const handleToggleDisappearingMessages = async () => {
		const newEnabled = !disappearingMessagesEnabled
		
		// Optymistyczna aktualizacja UI
		setDisappearingMessagesEnabled(newEnabled)
		setMenuLoading(true)

		try {
			// Wywołaj API
			await messagesApi.toggleDisappearingMessages(conversation.conversationId, newEnabled)
			
			// Emit socket event dla synchronizacji
			if (socket && connected) {
				socket.emit('toggle_disappearing_messages', {
					conversationId: conversation.conversationId,
					enabled: newEnabled,
				})
			}
			
			setShowMenu(false)
		} catch (error) {
			// Cofnij zmianę przy błędzie
			setDisappearingMessagesEnabled(!newEnabled)
			alert('Błąd przełączania trybu: ' + (error.response?.data?.error || error.message))
		} finally {
			setMenuLoading(false)
		}
	}

	// Optymistyczne dodanie wiadomości (zanim przyjdzie przez socket)
	const handleNewMessage = message => {
		setMessages(prev => [...prev, message])
	}

	// Usunięcie wiadomości z lokalnego stanu
	const handleMessageDeleted = messageId => {
		setMessages(prev => prev.filter(msg => msg.message_id !== messageId))
	}

	// Archiwizacja konwersacji
	const handleArchiveConversation = async () => {
		if (!confirm('Czy na pewno chcesz zarchiwizować tę konwersację?')) return

		try {
			setMenuLoading(true)
			await messagesApi.archiveConversation(conversation.conversationId)
			alert('Konwersacja zarchiwizowana! Znajdziesz ją w archiwum.')
			setShowMenu(false)
		} catch (err) {
			alert('Błąd archiwizacji: ' + (err.response?.data?.error || err.message))
		} finally {
			setMenuLoading(false)
		}
	}

	// Usunięcie chatu
	const handleDeleteChat = async () => {
		if (
			!confirm('Czy na pewno chcesz usunąć CAŁĄ konwersację? Wszystkie wiadomości zostaną usunięte po Twojej stronie.')
		)
			return

		try {
			setMenuLoading(true)
			await messagesApi.deleteChat(conversation.conversationId)
			alert('Konwersacja usunięta po Twojej stronie')
			setShowMenu(false)
			setMessages([])
		} catch (err) {
			alert('Błąd usuwania: ' + (err.response?.data?.error || err.message))
		} finally {
			setMenuLoading(false)
		}
	}

	const handleExportConversation = async () => {
		try {
			setMenuLoading(true)
			const response = await messagesApi.exportConversation(conversation.conversationId)

			const dataStr = JSON.stringify(response.data, null, 2)
			const dataBlob = new Blob([dataStr], { type: 'application/json' })
			const url = URL.createObjectURL(dataBlob)

			const link = document.createElement('a')
			link.href = url
			link.download = `chat-${conversation.name}-${Date.now()}.json`
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			URL.revokeObjectURL(url)

			alert('Konwersacja wyeksportowana!')
			setShowMenu(false)
		} catch (err) {
			alert('Błąd eksportu: ' + (err.response?.data?.error || err.message))
		} finally {
			setMenuLoading(false)
		}
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			{/* Header */}
			<div
				style={{
					padding: '15px',
					borderBottom: '1px solid #ddd',
					backgroundColor: '#fff',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
				}}>
				<div>
					<h3 style={{ margin: 0 }}>
						{conversation.type === 'group' ? '👥' : '💬'} {conversation.name}
					</h3>
					<p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
						{conversation.type === 'group' ? 'Grupa' : 'Rozmowa prywatna'}
						{connected ? ' • 🟢 Online' : ' • 🔴 Offline'}
					</p>
				</div>

				{/* Menu dropdown */}
				<div style={{ position: 'relative' }}>
					<button
						onClick={() => setShowMenu(!showMenu)}
						disabled={menuLoading}
						style={{
							padding: '8px 12px',
							backgroundColor: '#f8f9fa',
							border: '1px solid #ddd',
							borderRadius: '5px',
							cursor: menuLoading ? 'not-allowed' : 'pointer',
							fontSize: '18px',
						}}
						title="Opcje">
						⋮
					</button>

					{showMenu && (
						<div
							style={{
								position: 'absolute',
								top: '100%',
								right: 0,
								marginTop: '5px',
								backgroundColor: 'white',
								border: '1px solid #ddd',
								borderRadius: '8px',
								boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
								zIndex: 1000,
								minWidth: '200px',
								overflow: 'hidden',
							}}>
							<button
								onClick={handleExportConversation}
								disabled={menuLoading}
								style={{
									width: '100%',
									padding: '12px 16px',
									border: 'none',
									backgroundColor: 'white',
									textAlign: 'left',
									cursor: menuLoading ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									borderBottom: '1px solid #f0f0f0',
								}}
								onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
								onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
								📥 Eksportuj do JSON
							</button>

							<button
								onClick={handleToggleDisappearingMessages}
								disabled={menuLoading}
								style={{
									width: '100%',
									padding: '12px 16px',
									border: 'none',
									backgroundColor: 'white',
									textAlign: 'left',
									cursor: menuLoading ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									borderBottom: '1px solid #f0f0f0',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
								}}
								onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
								onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
								<span>⏱️ Znikające wiadomości</span>
								<span
									style={{
										width: '40px',
										height: '20px',
										backgroundColor: disappearingMessagesEnabled ? '#28a745' : '#ccc',
										borderRadius: '10px',
										position: 'relative',
										transition: 'background-color 0.2s',
									}}>
									<span
										style={{
											position: 'absolute',
											width: '16px',
											height: '16px',
											backgroundColor: 'white',
											borderRadius: '50%',
											top: '2px',
											left: disappearingMessagesEnabled ? '22px' : '2px',
											transition: 'left 0.2s',
											boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
										}}
									/>
								</span>
							</button>

							<button
								onClick={handleArchiveConversation}
								disabled={menuLoading}
								style={{
									width: '100%',
									padding: '12px 16px',
									border: 'none',
									backgroundColor: 'white',
									textAlign: 'left',
									cursor: menuLoading ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									borderBottom: '1px solid #f0f0f0',
								}}
								onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
								onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
								📦 Archiwizuj konwersację
							</button>

							<button
								onClick={handleDeleteChat}
								disabled={menuLoading}
								style={{
									width: '100%',
									padding: '12px 16px',
									border: 'none',
									backgroundColor: 'white',
									textAlign: 'left',
									cursor: menuLoading ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									color: '#dc3545',
								}}
								onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fff5f5')}
								onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
								🗑️ Usuń całą konwersację
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Messages */}
			{loading ? (
				<div
					style={{
						flex: 1,
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
					}}>
					<p>Ładowanie wiadomości...</p>
				</div>
			) : (
				<>
					{/* Baner znikających wiadomości */}
					{disappearingMessagesEnabled && disappearingTime && (
						<DisappearingMessagesBanner disappearingTime={disappearingTime} />
					)}
					<MessageList messages={messages} conversation={conversation} onMessageDeleted={handleMessageDeleted} disappearingMessagesEnabled={disappearingMessagesEnabled} disappearingMessagesEnabledAt={disappearingMessagesEnabledAt} disappearingTime={disappearingTime} />

					{/* Wskaźnik pisania */}
					{typingUsers.length > 0 && (
						<div
							style={{
								padding: '10px 20px',
								fontSize: '12px',
								color: '#666',
								fontStyle: 'italic',
								backgroundColor: '#f8f9fa',
							}}>
							{typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'pisze' : 'piszą'}...
						</div>
					)}
				</>
			)}

			{/* Input */}
			<MessageInput conversation={conversation} onMessageSent={handleNewMessage} />
		</div>
	)
}

export default ChatWindow
