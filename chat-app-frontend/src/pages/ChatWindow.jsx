import { useState, useEffect } from 'react'
import { messagesApi } from '../../api/messagesApi'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

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
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			{/* Header */}
			<div
				style={{
					padding: '15px',
					borderBottom: '1px solid #ddd',
					backgroundColor: '#fff',
				}}>
				<h3 style={{ margin: 0 }}>
					{conversation.type === 'group' ? '👥' : '💬'} {conversation.name}
				</h3>
				<p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
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
