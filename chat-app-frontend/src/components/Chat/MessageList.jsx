import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { messagesApi } from '../../api/messagesApi'
import { decryptMessage, getPrivateKey, getSessionKey } from '../../utils/encryption'

const MessageList = ({ messages, onMessageDeleted, conversation }) => {
	const { user } = useAuth()
	const messagesEndRef = useRef(null)
	const [hoveredMessage, setHoveredMessage] = useState(null)
	const [deletingMessage, setDeletingMessage] = useState(null)

	// 🔐 E2EE - Stany dla deszyfrowania
	const [decryptedMessages, setDecryptedMessages] = useState({})
	const [decryptionPassword, setDecryptionPassword] = useState(null)
	const [passwordAsked, setPasswordAsked] = useState(false)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	// 🔐 Poproś o hasło tylko raz, gdy są zaszyfrowane wiadomości
	useEffect(() => {
		const hasEncryptedMessages = messages.some(msg => msg.is_encrypted && msg.sender_id !== user?.userId)

		if (hasEncryptedMessages && !decryptionPassword && !passwordAsked) {
			setPasswordAsked(true)
			const password = prompt(
				'🔐 Podaj hasło aby odszyfrować wiadomości:\n\n' + 'To jest to samo hasło, którego używasz do logowania.'
			)

			if (password) {
				setDecryptionPassword(password)
			} else {
				console.warn('⚠️ Nie podano hasła - wiadomości pozostaną zaszyfrowane')
			}
		}
	}, [messages, user, decryptionPassword, passwordAsked])

	// 🔐 Odszyfruj wiadomości gdy mamy hasło
	useEffect(() => {
		if (!decryptionPassword || !conversation?.conversationId) return

		const privateKey = getPrivateKey(decryptionPassword)
		const sessionKey = getSessionKey(conversation.conversationId)

		if (!sessionKey) {
			console.warn('⚠️ Brak klucza sesji dla tej konwersacji')
			return
		}

		const newDecrypted = {}

		messages.forEach(msg => {
			// Odszyfruj tylko cudze zaszyfrowane wiadomości
			if (msg.is_encrypted && msg.sender_id !== user?.userId) {
				try {
					const plaintext = decryptMessage(msg.content, sessionKey)
					if (plaintext) {
						newDecrypted[msg.message_id] = plaintext
					} else {
						newDecrypted[msg.message_id] = '[Błąd deszyfrowania]'
					}
				} catch (error) {
					console.error(`❌ Błąd deszyfrowania wiadomości ${msg.message_id}:`, error)
					newDecrypted[msg.message_id] = '[Nie można odszyfrować]'
				}
			}
		})

		setDecryptedMessages(prev => ({
			...prev,
			...newDecrypted,
		}))
	}, [messages, decryptionPassword, conversation, user])

	// 🔐 Funkcja pobierająca treść wiadomości (zaszyfrowaną lub nie)
	const getDisplayContent = message => {
		const isMyMessage = message.sender_id === user?.userId

		// Jeśli to moja wiadomość lub nie jest zaszyfrowana - pokaż normalnie
		if (isMyMessage || !message.is_encrypted) {
			return message.content
		}

		// Jeśli zaszyfrowana i nie moja - pokaż odszyfrowaną lub placeholder
		return decryptedMessages[message.message_id] || '🔐 Deszyfrowanie...'
	}

	const handleDeleteMessage = async messageId => {
		if (!confirm('Czy na pewno chcesz usunąć tę wiadomość? (Zostanie usunięta tylko po Twojej stronie)')) {
			return
		}

		try {
			setDeletingMessage(messageId)
			await messagesApi.deleteMessage(messageId)

			// Powiadom rodzica o usunięciu
			if (onMessageDeleted) {
				onMessageDeleted(messageId)
			}
		} catch (err) {
			console.error('Błąd usuwania wiadomości:', err)
			alert('Nie udało się usunąć wiadomości')
		} finally {
			setDeletingMessage(null)
		}
	}

	if (messages.length === 0) {
		return (
			<div
				style={{
					flex: 1,
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					color: '#999',
				}}>
				<p>Brak wiadomości. Napisz coś!</p>
			</div>
		)
	}

	return (
		<div
			style={{
				flex: 1,
				overflowY: 'auto',
				padding: '20px',
				backgroundColor: '#f5f5f5',
			}}>
			{messages.map(message => {
				const isMyMessage = message.sender_id === user?.userId
				const isRead = message.readStatuses?.some(s => s.is_read)
				const isDeleting = deletingMessage === message.message_id

				// 🔐 Pobierz treść (zaszyfrowaną lub odszyfrowaną)
				const displayContent = getDisplayContent(message)

				return (
					<div
						key={message.message_id}
						style={{
							display: 'flex',
							justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
							marginBottom: '15px',
							position: 'relative',
						}}
						onMouseEnter={() => setHoveredMessage(message.message_id)}
						onMouseLeave={() => setHoveredMessage(null)}>
						<div
							style={{
								maxWidth: '60%',
								backgroundColor: isMyMessage ? '#007bff' : '#fff',
								color: isMyMessage ? '#fff' : '#000',
								padding: '10px 15px',
								borderRadius: '10px',
								boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
								opacity: isDeleting ? 0.5 : 1,
								position: 'relative',
							}}>
							{/* Nadawca (jeśli nie nasza wiadomość) */}
							{!isMyMessage && (
								<div
									style={{
										fontSize: '12px',
										fontWeight: 'bold',
										marginBottom: '5px',
										opacity: 0.8,
									}}>
									{message.sender?.username}
								</div>
							)}

							{/* 🔐 Treść wiadomości (zaszyfrowana lub odszyfrowana) */}
							<div
								style={{ fontSize: '14px', wordWrap: 'break-word', display: 'flex', alignItems: 'center', gap: '5px' }}>
								<span style={{ flex: 1 }}>{displayContent}</span>
								{/* 🔐 Ikona zamka dla zaszyfrowanych wiadomości */}
								{message.is_encrypted && (
									<span
										style={{
											fontSize: '12px',
											opacity: 0.7,
											marginLeft: '5px',
										}}
										title="Wiadomość zaszyfrowana end-to-end">
										🔒
									</span>
								)}
							</div>

							{/* Data i status */}
							<div
								style={{
									fontSize: '11px',
									marginTop: '5px',
									opacity: 0.7,
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
								}}>
								<span>
									{new Date(message.created_at).toLocaleTimeString('pl-PL', {
										hour: '2-digit',
										minute: '2-digit',
									})}
								</span>
								{isMyMessage && <span style={{ marginLeft: '10px' }}>{isRead ? '✓✓' : '✓'}</span>}
							</div>

							{/* Przycisk usuń (tylko dla własnych wiadomości, widoczny po hover) */}
							{isMyMessage && hoveredMessage === message.message_id && !isDeleting && (
								<button
									onClick={() => handleDeleteMessage(message.message_id)}
									style={{
										position: 'absolute',
										top: '-10px',
										right: '-10px',
										width: '24px',
										height: '24px',
										borderRadius: '50%',
										backgroundColor: '#dc3545',
										color: 'white',
										border: 'none',
										cursor: 'pointer',
										fontSize: '12px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
										zIndex: 10,
									}}
									title="Usuń wiadomość">
									×
								</button>
							)}

							{isDeleting && (
								<div
									style={{
										position: 'absolute',
										top: 0,
										left: 0,
										right: 0,
										bottom: 0,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontSize: '12px',
									}}>
									Usuwanie...
								</div>
							)}
						</div>
					</div>
				)
			})}
			<div ref={messagesEndRef} />
		</div>
	)
}

export default MessageList
