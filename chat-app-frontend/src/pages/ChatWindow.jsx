import { useState, useEffect } from 'react'
import { messagesApi } from '../../api/messagesApi'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

const palette = {
	headerBg: 'var(--chat-header-bg)',
	headerBorder: 'var(--chat-header-border)',
	textMuted: 'var(--color-text-muted)',
	background: 'var(--chat-background)',
	surface: 'var(--color-surface)'
}

const ChatWindow = ({ conversation }) => {
	const [messages, setMessages] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		loadMessages()
	}, [conversation.conversationId])

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

	const handleNewMessage = message => {
		setMessages(prev => [...prev, message])
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: palette.background }}>
			{/* Header */}
			<div
				style={{
					padding: '15px',
					borderBottom: `1px solid ${palette.headerBorder}`,
					backgroundColor: palette.headerBg,
					backdropFilter: 'blur(6px)'
				}}>
				<h3 style={{ margin: 0 }}>{conversation.type === 'group' ? '👥' : '💬'} {conversation.name}</h3>
				<p style={{ margin: '5px 0 0 0', fontSize: '12px', color: palette.textMuted }}>
					{conversation.type === 'group' ? 'Grupa' : 'Rozmowa prywatna'}
				</p>
			</div>

			{/* Messages */}
			{loading ? (
				<div
					style={{
						flex: 1,
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						color: palette.textMuted,
					}}>
					<p>Ładowanie wiadomości...</p>
				</div>
			) : (
				<MessageList messages={messages} />
			)}

			{/* Input */}
			<MessageInput conversation={conversation} onMessageSent={handleNewMessage} />
		</div>
	)
}

export default ChatWindow
