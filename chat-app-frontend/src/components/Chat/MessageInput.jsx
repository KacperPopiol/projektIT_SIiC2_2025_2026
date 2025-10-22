import { useState, useRef } from 'react'
import { useSocket } from '../../hooks/useSocket'

const MessageInput = ({ conversation, onMessageSent }) => {
	const [message, setMessage] = useState('')
	const [sending, setSending] = useState(false)
	const { socket, connected } = useSocket()
	const typingTimeoutRef = useRef(null)

	const handleTyping = () => {
		if (!connected || !socket) return

		// Wyślij event "typing"
		socket.emit('typing', {
			conversationId: conversation.conversationId,
			isGroup: conversation.type === 'group',
			groupId: conversation.groupId || null,
		})

		// Wyczyść poprzedni timeout
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current)
		}

		// Wyślij "stop_typing" po 2 sekundach bezczynności
		typingTimeoutRef.current = setTimeout(() => {
			socket.emit('stop_typing', {
				conversationId: conversation.conversationId,
				isGroup: conversation.type === 'group',
				groupId: conversation.groupId || null,
			})
		}, 2000)
	}

	const handleSubmit = async e => {
		e.preventDefault()

		if (!message.trim() || !connected) return

		setSending(true)

		try {
			// Wyślij "stop_typing" przed wysłaniem wiadomości
			socket.emit('stop_typing', {
				conversationId: conversation.conversationId,
				isGroup: conversation.type === 'group',
				groupId: conversation.groupId || null,
			})

			// Wyczyść timeout
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current)
			}

			// Wysyłanie przez Socket.io
			if (conversation.type === 'private') {
				socket.emit('send_private_message', {
					conversationId: conversation.conversationId,
					content: message.trim(),
				})
			} else {
				socket.emit('send_group_message', {
					conversationId: conversation.conversationId,
					groupId: conversation.groupId,
					content: message.trim(),
				})
			}

			setMessage('')
		} catch (error) {
			console.error('Błąd wysyłania wiadomości:', error)
			alert('Nie udało się wysłać wiadomości')
		} finally {
			setSending(false)
		}
	}

	const handleChange = e => {
		setMessage(e.target.value)
		handleTyping()
	}

	return (
		<form
			onSubmit={handleSubmit}
			style={{
				padding: '15px',
				borderTop: '1px solid #ddd',
				backgroundColor: '#fff',
				display: 'flex',
				gap: '10px',
			}}>
			<input
				type='text'
				value={message}
				onChange={handleChange}
				placeholder={connected ? 'Wpisz wiadomość...' : 'Łączenie...'}
				disabled={!connected || sending}
				style={{
					flex: 1,
					padding: '10px 15px',
					borderRadius: '20px',
					border: '1px solid #ddd',
					fontSize: '14px',
					outline: 'none',
				}}
			/>
			<button
				type='submit'
				disabled={!message.trim() || !connected || sending}
				style={{
					padding: '10px 25px',
					backgroundColor: !message.trim() || !connected || sending ? '#ccc' : '#007bff',
					color: 'white',
					border: 'none',
					borderRadius: '20px',
					cursor: !message.trim() || !connected || sending ? 'not-allowed' : 'pointer',
					fontSize: '14px',
					fontWeight: 'bold',
				}}>
				{sending ? '...' : '📤 Wyślij'}
			</button>
		</form>
	)
}

export default MessageInput
