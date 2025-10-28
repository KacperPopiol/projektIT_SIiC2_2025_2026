import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { messagesApi } from '../../api/messagesApi'
import {
	deriveSharedSecretAES,
	decryptMessageWithSharedSecret,
	getCachedSharedSecret,
	cacheSharedSecret,
} from '../../utils/encryption'
import { keysApi } from '../../api/keysApi'

const MessageList = ({ messages, conversation, onMessageDeleted }) => {
	const { user, privateKeyDH } = useAuth()
	const messagesEndRef = useRef(null)
	const [hoveredMessage, setHoveredMessage] = useState(null)
	const [deletingMessage, setDeletingMessage] = useState(null)
	const [decryptedMessages, setDecryptedMessages] = useState({})
	const [sharedSecretAES, setSharedSecretAES] = useState(null)
	const [loadingKeys, setLoadingKeys] = useState(true)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	// ✅ INICJALIZACJA SHARED SECRET (ECDH)
	useEffect(() => {
		console.log('Hallo?')

		console.log('🔍 Type:', conversation?.type)
		console.log('🔍 ConversationId:', conversation?.conversationId)
		console.log('🔍 PrivateKeyDH:', privateKeyDH)

		if (conversation?.type === 'private' && privateKeyDH && conversation.conversationId) {
			console.log('Inicjalizacja procedury uzyskiwania wspólnego sekretu ')
			initializeSharedSecret()
		} else if (conversation?.type === 'group') {
			// Dla grup póki co bez szyfrowania
			setLoadingKeys(false)
		}
	}, [conversation, privateKeyDH])

	// DEBUG
	// useEffect(() => {
	// 	console.log('Messages received:', messages.length)
	// 	messages.forEach((msg, i) => {
	// 		// ✅ 1. PEŁNY obiekt wiadomości
	// 		console.log(`Message ${i} - FULL OBJECT:`, msg)

	// 		// ✅ 2. Wszystkie klucze obiektu
	// 		console.log(`Message ${i} - KEYS:`, Object.keys(msg))

	// 		// ✅ 3. Szczegółowe informacje
	// 		console.log(`Message ${i} - DETAILS:`, {
	// 			messageid: msg.messageid,
	// 			message_id: msg.message_id, // sprawdź obie wersje
	// 			is_encrypted: msg.is_encrypted,
	// 			isencrypted: msg.isencrypted, // sprawdź obie wersje
	// 			isEncrypted: msg.isEncrypted, // sprawdź camelCase
	// 			content_preview: msg.content?.substring(0, 80),
	// 			full_content_type: typeof msg.content,
	// 			sender: msg.sender,
	// 			created_at: msg.createdat || msg.created_at,
	// 		})

	// 		// ✅ 4. Stringify całego obiektu (najlepsze do sprawdzenia wszystkiego)
	// 		console.log(`Message ${i} - JSON:`, JSON.stringify(msg, null, 2))
	// 	})
	// }, [messages])

	const initializeSharedSecret = async () => {
		try {
			console.log('🔑 START initializeSharedSecret')
			console.log('- conversationId:', conversation.conversationId)
			console.log('- privateKeyDH:', !!privateKeyDH)

			setLoadingKeys(true)

			let sharedSecret = await getCachedSharedSecret(conversation.conversationId)
			console.log('- Cached secret:', !!sharedSecret)

			if (!sharedSecret) {
				console.log('⚠️ Pobieranie kluczy z API...')

				const response = await keysApi.getConversationPublicKeys(conversation.conversationId)
				console.log('- Odpowiedź API:', response)

				const otherUser = response.publicKeys.find(k => k.userId !== user.userId)
				console.log('- Drugi użytkownik:', otherUser)

				if (!otherUser?.publicKey) {
					console.error('❌ Brak klucza publicznego rozmówcy')
					setLoadingKeys(false)
					return
				}

				const otherPublicKeyJwk = JSON.parse(otherUser.publicKey)
				console.log('- Klucz publiczny rozmówcy:', otherPublicKeyJwk)

				console.log('🔄 Wyliczam shared secret...')
				sharedSecret = await deriveSharedSecretAES(privateKeyDH, otherPublicKeyJwk)
				console.log('- Shared secret wyliczony:', !!sharedSecret)

				await cacheSharedSecret(conversation.conversationId, sharedSecret)
			}

			setSharedSecretAES(sharedSecret)
			console.log('✅ Shared secret ustawiony')
		} catch (error) {
			console.error('❌ Błąd initializeSharedSecret:', error)
			console.error('Stack:', error.stack)
		} finally {
			setLoadingKeys(false)
			console.log('🔑 END initializeSharedSecret')
		}
	}

	// ✅ DESZYFROWANIE WIADOMOŚCI
	useEffect(() => {
		if (!sharedSecretAES) {
			console.log('Błąd wspólnego sekretu')
			return
		}

		const decryptMessages = async () => {
			const decrypted = {}

			for (const msg of messages) {
				if (msg.is_encrypted) {
					try {
						// Parse JSON: { ciphertext, iv }
						const encryptedData = JSON.parse(msg.content)

						// Odszyfruj AES-GCM
						const plaintext = await decryptMessageWithSharedSecret(encryptedData, sharedSecretAES)

						decrypted[msg.message_id] = plaintext
					} catch (error) {
						console.error(`❌ Błąd deszyfrowania wiadomości ${msg.message_id}:`, error)
						decrypted[msg.message_id] = '[Nie można odszyfrować]'
					}
				}
			}

			setDecryptedMessages(decrypted)
		}

		decryptMessages()
	}, [messages, sharedSecretAES])

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
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					color: '#999',
				}}>
				{loadingKeys && conversation?.type === 'private' ? (
					<>
						<p>🔑 Inicjalizacja kluczy szyfrowania...</p>
						<p style={{ fontSize: '12px' }}>Wyliczam shared secret (ECDH)</p>
					</>
				) : (
					<p>Brak wiadomości. Napisz coś!</p>
				)}
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
			{/* ✅ Status szyfrowania */}
			{conversation?.type === 'private' && (
				<div
					style={{
						backgroundColor: sharedSecretAES ? '#d4edda' : '#fff3cd',
						border: `1px solid ${sharedSecretAES ? '#c3e6cb' : '#ffeaa7'}`,
						borderRadius: '8px',
						padding: '10px',
						marginBottom: '15px',
						fontSize: '12px',
						color: '#333',
						textAlign: 'center',
					}}>
					{loadingKeys ? (
						<>⏳ Inicjalizacja kluczy...</>
					) : sharedSecretAES ? (
						<>🔒 Konwersacja zabezpieczona end-to-end (ECDH + AES-256)</>
					) : (
						<>⚠️ Szyfrowanie niedostępne</>
					)}
				</div>
			)}

			{messages.map(message => {
				const isMyMessage = message.sender_id === user?.userId
				const isRead = message.readStatuses?.some(s => s.is_read)
				const isDeleting = deletingMessage === message.message_id

				// ✅ WYŚWIETL ODSZYFROWANĄ LUB PLAINTEXT TREŚĆ
				const displayContent = (() => {
					if (message.is_encrypted) {
						// Zaszyfrowana wiadomość
						if (decryptedMessages[message.message_id]) {
							return decryptedMessages[message.message_id]
						} else if (loadingKeys) {
							return '🔑 Ładowanie kluczy...'
						} else if (!sharedSecretAES) {
							return '⚠️ Brak klucza do odszyfrowania'
						} else {
							return '🔒 Deszyfrowanie...'
						}
					} else {
						// Nieszyfrowana wiadomość (stare lub grupowe)
						return message.content
					}
				})()

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

							{/* ✅ Treść wiadomości (odszyfrowana lub plaintext) */}
							<div style={{ fontSize: '14px', wordWrap: 'break-word' }}>{displayContent}</div>

							{/* ✅ Ikona szyfrowania */}
							{message.is_encrypted && (
								<div
									style={{
										fontSize: '10px',
										opacity: 0.6,
										marginTop: '3px',
									}}>
									🔒 E2EE
								</div>
							)}

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
