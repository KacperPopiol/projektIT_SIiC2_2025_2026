import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { messagesApi } from '../../api/messagesApi'

const MessageList = ({ messages, onMessageDeleted }) => {
	const { user } = useAuth()
	const messagesEndRef = useRef(null)
	const [hoveredMessage, setHoveredMessage] = useState(null)
	const [deletingMessage, setDeletingMessage] = useState(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

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

							{/* Treść wiadomości */}
							<div style={{ fontSize: '14px', wordWrap: 'break-word' }}>{message.content}</div>

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
									title='Usuń wiadomość'>
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
