import { useState, useRef, useEffect } from 'react'
import { useSocket } from '../../hooks/useSocket'
import { useAuth } from '../../hooks/useAuth'
import {
	deriveSharedSecretAES,
	encryptMessageWithSharedSecret,
	getCachedSharedSecret,
	cacheSharedSecret,
} from '../../utils/encryption'
import { keysApi } from '../../api/keysApi'

const MessageInput = ({ conversation, onMessageSent }) => {
	const [message, setMessage] = useState('')
	const [sending, setSending] = useState(false)
	const [sharedSecretAES, setSharedSecretAES] = useState(null)
	const [loadingKeys, setLoadingKeys] = useState(true)
	const { socket, connected } = useSocket()
	const { user, privateKeyDH } = useAuth() // ✅ Klucz prywatny z Context
	const typingTimeoutRef = useRef(null)

	// ✅ INICJALIZACJA SHARED SECRET (ECDH)
	useEffect(() => {
		if (conversation.type === 'private' && privateKeyDH && conversation.conversationId) {
			initializeSharedSecret()
		} else if (conversation.type === 'group') {
			// Dla grup póki co bez szyfrowania (lub zaimplementuj grupowy klucz)
			setLoadingKeys(false)
		}
	}, [conversation, privateKeyDH])

	const initializeSharedSecret = async () => {
		try {
			setLoadingKeys(true)

			// 1. Sprawdź cache localStorage
			let sharedSecret = await getCachedSharedSecret(conversation.conversationId)

			if (!sharedSecret) {
				console.log('⚠️ Brak shared secret w cache - wyliczam z ECDH...')

				// 2. Pobierz klucze publiczne uczestników konwersacji
				const response = await keysApi.getConversationPublicKeys(conversation.conversationId)

				// 3. Znajdź klucz publiczny drugiego użytkownika (nie siebie)
				const otherUser = response.publicKeys.find(k => k.userId !== user.userId)

				if (!otherUser?.publicKey) {
					console.error('❌ Brak klucza publicznego rozmówcy - wiadomości nie będą szyfrowane')
					setLoadingKeys(false)
					return
				}

				const otherPublicKeyJwk = JSON.parse(otherUser.publicKey)

				// 4. 🟤 WYLICZ SHARED SECRET używając ECDH
				sharedSecret = await deriveSharedSecretAES(privateKeyDH, otherPublicKeyJwk)

				// 5. Cache lokalnie
				await cacheSharedSecret(conversation.conversationId, sharedSecret)

				console.log('✅ Shared secret (klucz AES) wyliczony i zapisany')
			} else {
				console.log('📥 Shared secret załadowany z cache')
			}

			setSharedSecretAES(sharedSecret)
		} catch (error) {
			console.error('❌ Błąd inicjalizacji shared secret:', error)
		} finally {
			setLoadingKeys(false)
		}
	}

	// ✅ OBSŁUGA BŁĘDÓW Z BACKENDU
	useEffect(() => {
		if (!socket) return

		const handleError = errorData => {
			console.error('Socket error:', errorData)

			if (errorData.code === 'NOT_FRIENDS') {
				alert(
					'⚠️ Nie możesz wysłać wiadomości\n\n' +
						'Ta osoba nie jest już Twoim znajomym.\n' +
						'Dodaj ją ponownie w zakładce "👥 Znajomi" aby móc pisać.'
				)
			} else if (errorData.code === 'INVALID_DATA') {
				alert('Błąd: Nieprawidłowe dane wiadomości')
			} else if (errorData.code === 'NOT_FOUND') {
				alert('Błąd: Konwersacja nie została znaleziona')
			} else if (errorData.code === 'RECIPIENT_NOT_FOUND') {
				alert('Błąd: Odbiorca nie został znaleziony')
			} else {
				alert('Błąd wysyłania: ' + (errorData.message || 'Nieznany błąd'))
			}

			setSending(false)
		}

		const handleMessageSent = data => {
			console.log('✅ Wiadomość wysłana:', data)
			setSending(false)
		}

		socket.on('error', handleError)
		socket.on('message_sent', handleMessageSent)

		return () => {
			socket.off('error', handleError)
			socket.off('message_sent', handleMessageSent)
		}
	}, [socket])

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

		if (!message.trim() || !connected || sending) return

		setSending(true)
		const originalMessage = message.trim()

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

			let contentToSend = originalMessage
			let isEncrypted = false

			// ✅ SZYFROWANIE DLA KONWERSACJI PRYWATNEJ (ECDH + AES)
			if (conversation.type === 'private' && sharedSecretAES) {
				try {
					// Zaszyfruj wiadomość shared secret (AES-GCM)
					const encrypted = await encryptMessageWithSharedSecret(originalMessage, sharedSecretAES)

					// { ciphertext: "base64...", iv: "base64..." }
					contentToSend = JSON.stringify(encrypted)
					isEncrypted = true

					console.log('🔒 Wiadomość zaszyfrowana (E2EE: ECDH + AES-GCM)')
				} catch (encryptError) {
					console.error('❌ Błąd szyfrowania:', encryptError)
					alert('Nie udało się zaszyfrować wiadomości')
					setSending(false)
					return
				}
			} else if (conversation.type === 'private' && !sharedSecretAES) {
				console.warn('⚠️ Brak shared secret - wiadomość wysłana bez szyfrowania')
			}

			// ✅ Wysyłanie przez Socket.io
			if (conversation.type === 'private') {
				socket.emit('send_private_message', {
					conversationId: conversation.conversationId,
					content: contentToSend,
					isEncrypted: isEncrypted,
				})
			} else {
				socket.emit('send_group_message', {
					conversationId: conversation.conversationId,
					groupId: conversation.groupId,
					content: contentToSend,
				})
			}

			// Wyczyść message
			setMessage('')

			// Timeout zabezpieczający (jeśli backend nie odpowie)
			setTimeout(() => {
				if (sending) {
					console.warn('⚠️ Brak odpowiedzi z backendu - reset sending')
					setSending(false)
				}
			}, 5000)
		} catch (error) {
			console.error('❌ Błąd wysyłania wiadomości:', error)
			alert('Nie udało się wysłać wiadomości')
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
				flexDirection: 'column',
				gap: '10px',
			}}>
			{/* ✅ Status szyfrowania */}
			{conversation.type === 'private' && (
				<div
					style={{
						fontSize: '11px',
						color: sharedSecretAES ? '#28a745' : '#ffc107',
						display: 'flex',
						alignItems: 'center',
						gap: '5px',
					}}>
					{loadingKeys ? (
						<>⏳ Inicjalizacja kluczy szyfrowania...</>
					) : sharedSecretAES ? (
						<>🔒 Wiadomości szyfrowane end-to-end (ECDH + AES-256)</>
					) : (
						<>⚠️ Szyfrowanie niedostępne - wiadomości wysyłane bez szyfrowania</>
					)}
				</div>
			)}

			<div style={{ display: 'flex', gap: '10px' }}>
				<input
					type="text"
					value={message}
					onChange={handleChange}
					placeholder={connected ? 'Wpisz wiadomość...' : 'Łączenie...'}
					disabled={!connected || sending || loadingKeys}
					style={{
						flex: 1,
						padding: '10px 15px',
						borderRadius: '20px',
						border: '1px solid #ddd',
						fontSize: '14px',
						outline: 'none',
						backgroundColor: sending || loadingKeys ? '#f5f5f5' : 'white',
						cursor: sending || loadingKeys ? 'not-allowed' : 'text',
					}}
				/>
				<button
					type="submit"
					disabled={!message.trim() || !connected || sending || loadingKeys}
					style={{
						padding: '10px 25px',
						backgroundColor: !message.trim() || !connected || sending || loadingKeys ? '#ccc' : '#007bff',
						color: 'white',
						border: 'none',
						borderRadius: '20px',
						cursor: !message.trim() || !connected || sending || loadingKeys ? 'not-allowed' : 'pointer',
						fontSize: '14px',
						fontWeight: 'bold',
						transition: 'background-color 0.2s',
					}}>
					{loadingKeys ? '🔑 Klucze...' : sending ? '⏳ Wysyłanie...' : '📤 Wyślij'}
				</button>
			</div>
		</form>
	)
}

export default MessageInput
