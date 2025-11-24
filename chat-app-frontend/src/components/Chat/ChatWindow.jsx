import { useState, useEffect, useMemo } from 'react'
import { messagesApi } from '../../api/messagesApi'
import { usersApi } from '../../api/usersApi'
import { useSocket } from '../../hooks/useSocket'
import { useAuth } from '../../hooks/useAuth'
import { useThemeContext } from '../../contexts/ThemeContext'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import DisappearingMessagesBanner from './DisappearingMessagesBanner'
import ThemePickerModal from './ThemePickerModal'
import { CHAT_THEMES } from '../../constants/chatThemes'

const ChatWindow = ({ conversation }) => {
	const [messages, setMessages] = useState([])
	const [loading, setLoading] = useState(true)
	const [typingUsers, setTypingUsers] = useState([])
	const [showMenu, setShowMenu] = useState(false)
	const [menuLoading, setMenuLoading] = useState(false)
	const [disappearingMessagesEnabled, setDisappearingMessagesEnabled] = useState(false)
	const [disappearingMessagesEnabledAt, setDisappearingMessagesEnabledAt] = useState(null)
	const [disappearingTime, setDisappearingTime] = useState(null) // Czas znikania użytkownika który włączył tryb
	const [availableThemes, setAvailableThemes] = useState(CHAT_THEMES)
	const [activeTheme, setActiveTheme] = useState(CHAT_THEMES[0])
	const [themeModalOpen, setThemeModalOpen] = useState(false)
	const [themeLoading, setThemeLoading] = useState(false)
	const { socket, connected } = useSocket()
	const { user } = useAuth()
	const { isDarkMode } = useThemeContext()

	const normalizeThemePayload = theme => {
		if (!theme) return null
		const key = theme.key || theme.themeKey || theme.id || 'default'
		const baseDefinition = CHAT_THEMES.find(t => t.key === key) || CHAT_THEMES[0]
		const resolvedVariables =
			key === 'default'
				? baseDefinition.variables
				: theme.variables || theme.themeVariables || baseDefinition.variables || CHAT_THEMES[0].variables

		return {
			key,
			name: theme.name || theme.themeName || theme.label || baseDefinition.name || 'Motyw',
			variables: resolvedVariables,
		}
	}

	const isSameConversation = id => {
		if (id === undefined || id === null) return false
		return String(id) === String(conversation.conversationId)
	}

	const themeVariables = useMemo(() => {
		if (activeTheme?.variables) {
			return activeTheme.variables
		}
		return CHAT_THEMES[0].variables
	}, [activeTheme])

	const isCssVariable = value => typeof value === 'string' && value.startsWith('var(')
	const withOpacity = (color, fallbackVar, opacity = '33') => {
		if (!color) {
			return fallbackVar
		}
		return isCssVariable(color) ? fallbackVar : `${color}${opacity}`
	}

	const accentColor = themeVariables.accentColor || 'var(--color-accent)'
	// Użyj globalnego motywu dla headera i menu
	const headerBackgroundColor = 'var(--chat-header-bg)'
	const headerBorderColor = 'var(--chat-header-border)'
	const headerTextColor = 'var(--color-text-primary)'
	const menuBackgroundColor = 'var(--chat-menu-bg)'
	const menuBorderColor = 'var(--chat-menu-border)'
	const menuTextColor = 'var(--chat-menu-text)'
	const typingBackgroundColor =
		themeVariables.typingBackgroundColor || (isCssVariable(accentColor) ? 'var(--chat-typing-bg)' : 'var(--color-surface)')
	const menuHoverBackgroundColor = 'var(--chat-menu-hover-bg)'
	const handleMenuItemEnter = event => {
		event.currentTarget.style.backgroundColor = menuHoverBackgroundColor
	}
	const handleMenuItemLeave = event => {
		event.currentTarget.style.backgroundColor = menuBackgroundColor
	}

	const addMessageToList = newMessage => {
		if (!newMessage || !newMessage.message_id) {
			return
		}

		const normalizedMessage = {
			...newMessage,
			message_type: newMessage.message_type || newMessage.messageType || 'user',
			system_payload: newMessage.system_payload || newMessage.systemPayload || null,
		}

		let themeFromPayload = null
		if (
			normalizedMessage.message_type === 'system' &&
			normalizedMessage.system_payload &&
			normalizedMessage.system_payload.type === 'theme_change'
		) {
			const payload = normalizedMessage.system_payload
			themeFromPayload = normalizeThemePayload({
				key: payload.themeKey,
				name: payload.themeName,
				variables: payload.variables,
			})
		}

		setMessages(prev => {
			const exists = prev.some(msg => msg.message_id === normalizedMessage.message_id)
			if (exists) {
				return prev
			}
			return [...prev, normalizedMessage]
		})

		if (themeFromPayload) {
			setActiveTheme(themeFromPayload)
		}
	}

	// Ładowanie wiadomości i ustawień konwersacji przy zmianie konwersacji
	useEffect(() => {
		loadMessages()
		loadConversationSettings()
	}, [conversation.conversationId])

	// Ładowanie listy motywów (raz na start)
	useEffect(() => {
		const fetchThemes = async () => {
			try {
				const response = await messagesApi.getAvailableThemes()
				if (response?.success && Array.isArray(response.themes) && response.themes.length > 0) {
					setAvailableThemes(response.themes)
				}
			} catch (error) {
				console.error('Błąd ładowania motywów czatu:', error)
			}
		}

		fetchThemes()
	}, [])

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
			if (isSameConversation(data.conversationId)) {
				addMessageToList({
						message_id: data.messageId,
					conversation_id: Number(data.conversationId),
						sender_id: data.senderId,
						content: data.content,
						is_encrypted: data.isEncrypted,
					message_type: data.messageType || 'user',
					system_payload: data.systemPayload || null,
						created_at: data.createdAt,
						sender: {
							username: data.senderUsername,
						},
						readStatuses: [],
						files: data.files || [], // Dodaj pliki z socket event
				})
			}
		}

		// Nasłuchiwanie na nowe wiadomości grupowe
		const handleNewGroupMessage = data => {
			console.log('📨 New group message received:', data)
			if (isSameConversation(data.conversationId)) {
				addMessageToList({
						message_id: data.messageId,
					conversation_id: Number(data.conversationId),
						sender_id: data.senderId,
						content: data.content,
						is_encrypted: data.isEncrypted,
					message_type: data.messageType || 'user',
					system_payload: data.systemPayload || null,
						created_at: data.createdAt,
						sender: {
							username: data.senderUsername,
						},
						readStatuses: [],
						files: data.files || [], // Dodaj pliki z socket event
				})
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
			if (isSameConversation(data.conversationId)) {
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

		const handleConversationThemeChanged = data => {
			if (isSameConversation(data.conversationId) && data.theme) {
				const normalizedTheme = normalizeThemePayload(data.theme)
				if (normalizedTheme) {
					setActiveTheme(normalizedTheme)
				}
			}
		}

		// Listenery
		socket.on('new_private_message', handleNewPrivateMessage)
		socket.on('new_group_message', handleNewGroupMessage)
		socket.on('message_read', handleMessageRead)
		socket.on('user_typing', handleUserTyping)
		socket.on('user_stop_typing', handleUserStopTyping)
		socket.on('disappearing_messages_toggled', handleDisappearingMessagesToggled)
		socket.on('message_disappeared', handleMessageDisappeared)
		socket.on('conversation_theme_changed', handleConversationThemeChanged)

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
			socket.off('conversation_theme_changed', handleConversationThemeChanged)

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

				if (response.settings.theme) {
					const normalizedTheme = normalizeThemePayload(response.settings.theme)
					if (normalizedTheme) {
						setActiveTheme(normalizedTheme)
					}
				} else {
					setActiveTheme(CHAT_THEMES[0])
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
			const apiResponse = await messagesApi.toggleDisappearingMessages(conversation.conversationId, newEnabled)

			if (apiResponse?.settings) {
				const settings = apiResponse.settings
				setDisappearingMessagesEnabled(settings.disappearing_messages_enabled ?? newEnabled)
				setDisappearingMessagesEnabledAt(settings.disappearing_messages_enabled_at || null)

				if (typeof settings.disappearing_time !== 'undefined') {
					setDisappearingTime(settings.disappearing_time || null)
				} else if (!settings.disappearing_messages_enabled) {
					setDisappearingTime(null)
				}
			} else {
				await loadConversationSettings()
			}
			
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

	const handleOpenThemeModal = () => {
		setShowMenu(false)
		setThemeModalOpen(true)
	}

	const handleCloseThemeModal = () => {
		if (!themeLoading) {
			setThemeModalOpen(false)
		}
	}

	const handleThemeSelect = async theme => {
		if (!theme || theme.key === activeTheme?.key) {
			setThemeModalOpen(false)
			return
		}

		setThemeLoading(true)
		try {
			const response = await messagesApi.setConversationTheme(conversation.conversationId, theme.key)

			if (response?.theme) {
				setActiveTheme(response.theme)
			}

			if (response?.systemMessage) {
				const systemMessage = response.systemMessage
				addMessageToList({
					message_id: systemMessage.message_id,
					conversation_id: conversation.conversationId,
					sender_id: systemMessage.sender_id,
					content: systemMessage.content,
					is_encrypted: false,
					message_type: systemMessage.message_type || 'system',
					system_payload: systemMessage.system_payload || null,
					created_at: systemMessage.created_at,
					sender: {
						username: user?.username || 'Ty',
					},
					readStatuses: [],
					files: [],
				})
			}

			setThemeModalOpen(false)
		} catch (error) {
			console.error('Błąd ustawiania motywu:', error)
			alert('Nie udało się ustawić motywu: ' + (error.response?.data?.error || error.message))
		} finally {
			setThemeLoading(false)
		}
	}

	// Optymistyczne dodanie wiadomości (zanim przyjdzie przez socket)
	const handleNewMessage = message => {
		addMessageToList(message)
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
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				backgroundColor: themeVariables.backgroundColor || 'var(--chat-background)',
				backgroundImage: themeVariables.backgroundImage || 'none',
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				transition: 'background 0.3s ease',
			}}>
			{/* Header */}
			<div
				style={{
					padding: '15px',
					borderBottom: `1px solid ${headerBorderColor}`,
					backgroundColor: headerBackgroundColor,
					backdropFilter: 'blur(6px)',
					position: 'sticky',
					top: 0,
					zIndex: 100,
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					color: headerTextColor,
				}}>
				<div>
					<h3 style={{ margin: 0, color: headerTextColor }}>
						{conversation.type === 'group' ? '👥' : '💬'} {conversation.name}
					</h3>
					<p style={{ margin: '5px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
						{conversation.type === 'group' ? 'Grupa' : 'Rozmowa prywatna'}
						{connected ? (
							<span style={{ color: accentColor, marginLeft: '6px' }}>• 🟢 Online</span>
						) : (
							<span style={{ color: 'var(--color-danger)', marginLeft: '6px' }}>• 🔴 Offline</span>
						)}
					</p>
				</div>

				{/* Menu dropdown */}
				<div style={{ position: 'relative' }}>
					<button
						onClick={() => setShowMenu(!showMenu)}
						disabled={menuLoading}
						style={{
							padding: '8px 12px',
							backgroundColor: menuBackgroundColor,
							border: `1px solid ${menuBorderColor}`,
							borderRadius: '5px',
							cursor: menuLoading ? 'not-allowed' : 'pointer',
							fontSize: '18px',
							color: accentColor,
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
								backgroundColor: menuBackgroundColor,
								border: `1px solid ${menuBorderColor}`,
								borderRadius: '8px',
								boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
								zIndex: 2000,
								minWidth: '200px',
								overflow: 'hidden',
								color: menuTextColor,
							}}>
							<button
								onClick={handleOpenThemeModal}
								disabled={menuLoading || themeLoading}
								style={{
									width: '100%',
									padding: '12px 16px',
									border: 'none',
									backgroundColor: menuBackgroundColor,
									textAlign: 'left',
									cursor: menuLoading || themeLoading ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									borderBottom: `1px solid ${menuBorderColor}`,
									color: menuTextColor,
								}}
								onMouseEnter={handleMenuItemEnter}
								onMouseLeave={handleMenuItemLeave}>
								🎨 Zmień motyw
							</button>

							<button
								onClick={handleExportConversation}
								disabled={menuLoading}
								style={{
									width: '100%',
									padding: '12px 16px',
									border: 'none',
									backgroundColor: menuBackgroundColor,
									textAlign: 'left',
									cursor: menuLoading ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									borderBottom: `1px solid ${menuBorderColor}`,
									color: menuTextColor,
								}}
								onMouseEnter={handleMenuItemEnter}
								onMouseLeave={handleMenuItemLeave}>
								📥 Eksportuj do JSON
							</button>

							<button
								onClick={handleToggleDisappearingMessages}
								disabled={menuLoading}
								style={{
									width: '100%',
									padding: '12px 16px',
									border: 'none',
									backgroundColor: disappearingMessagesEnabled ? 'var(--button-success-bg)' : menuBackgroundColor,
									textAlign: 'left',
									cursor: menuLoading ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									borderBottom: `1px solid ${menuBorderColor}`,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									color: disappearingMessagesEnabled ? 'var(--button-success-text)' : menuTextColor,
								}}
								onMouseEnter={handleMenuItemEnter}
								onMouseLeave={handleMenuItemLeave}>
								<span>⏱️ Znikające wiadomości</span>
								<span
									style={{
										width: '40px',
										height: '20px',
										backgroundColor: disappearingMessagesEnabled ? 'var(--button-success-bg)' : 'var(--color-border)',
										borderRadius: '10px',
										position: 'relative',
										transition: 'background-color 0.2s',
									}}
								>
									<span
										style={{
											position: 'absolute',
											width: '16px',
											height: '16px',
											backgroundColor: 'var(--color-surface)',
											borderRadius: '50%',
											top: '2px',
											left: disappearingMessagesEnabled ? '22px' : '2px',
											transition: 'left 0.2s',
											boxShadow: 'var(--shadow-sm)',
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
									backgroundColor: menuBackgroundColor,
									textAlign: 'left',
									cursor: menuLoading ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									borderBottom: `1px solid ${menuBorderColor}`,
									color: menuTextColor,
								}}
								onMouseEnter={handleMenuItemEnter}
								onMouseLeave={handleMenuItemLeave}>
								📦 Archiwizuj konwersację
							</button>

							<button
								onClick={handleDeleteChat}
								disabled={menuLoading}
								style={{
									width: '100%',
									padding: '12px 16px',
									border: 'none',
									backgroundColor: menuBackgroundColor,
									textAlign: 'left',
									cursor: menuLoading ? 'not-allowed' : 'pointer',
									fontSize: '14px',
									color: 'var(--color-danger)',
								}}
								onMouseEnter={handleMenuItemEnter}
								onMouseLeave={handleMenuItemLeave}>
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
					<MessageList
						messages={messages}
						conversation={conversation}
						onMessageDeleted={handleMessageDeleted}
						disappearingMessagesEnabled={disappearingMessagesEnabled}
						disappearingMessagesEnabledAt={disappearingMessagesEnabledAt}
						disappearingTime={disappearingTime}
						activeTheme={activeTheme}
					/>

					{/* Wskaźnik pisania */}
					{typingUsers.length > 0 && (
						<div
							style={{
								padding: '10px 20px',
								fontSize: '12px',
								color: 'var(--color-text-muted)',
								fontStyle: 'italic',
								backgroundColor: typingBackgroundColor,
							}}>
							{typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'pisze' : 'piszą'}...
						</div>
					)}
				</>
			)}

			{/* Input */}
			<MessageInput conversation={conversation} onMessageSent={handleNewMessage} themeVariables={themeVariables} />

			<ThemePickerModal
				isOpen={themeModalOpen}
				onClose={handleCloseThemeModal}
				themes={availableThemes}
				selectedThemeKey={activeTheme?.key}
				onSelect={handleThemeSelect}
				isSaving={themeLoading}
			/>
		</div>
	)
}

export default ChatWindow
