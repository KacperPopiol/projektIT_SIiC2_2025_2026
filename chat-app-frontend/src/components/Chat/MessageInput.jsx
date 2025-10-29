import { useState, useRef, useEffect } from 'react'
import { useSocket } from '../../hooks/useSocket'
import { useAuth } from '../../hooks/useAuth'
import {
	deriveSharedSecretAES,
	encryptMessageWithSharedSecret,
	getCachedSharedSecret,
	cacheSharedSecret,
	getPrivateKeyDHLocally,
	importPrivateKeyDH,
} from '../../utils/encryption'
import { encryptGroupMessage, cacheGroupKey, getCachedGroupKey } from '../../utils/groupEncryption'
import { keysApi } from '../../api/keysApi'
import { groupsApi } from '../../api/groupsApi'

const MessageInput = ({ conversation, onMessageSent }) => {
	const [message, setMessage] = useState('')
	const [sending, setSending] = useState(false)
	const [sharedSecretAES, setSharedSecretAES] = useState(null)
	const [loadingKeys, setLoadingKeys] = useState(true)
	const { socket, connected } = useSocket()
	const { user, privateKeyDH } = useAuth()
	const [groupKey, setGroupKey] = useState(null)
	const typingTimeoutRef = useRef(null)

	// ✅ INICJALIZACJA SHARED SECRET (ECDH)
	useEffect(() => {
		if (conversation.type === 'private' && privateKeyDH && conversation.conversationId) {
			initializeSharedSecret()
		} else if (conversation.type === 'group' && conversation.groupId) {
			initializeGroupKey()
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

	const initializeGroupKey = async () => {
		try {
			setLoadingKeys(true)
			console.log('🔐 Inicjalizacja klucza grupowego...')

			// 1. Sprawdź cache lokalny
			let cachedKey = getCachedGroupKey(conversation.groupId)

			if (cachedKey) {
				setGroupKey(cachedKey)
				console.log('✅ Klucz grupowy załadowany z cache')
				setLoadingKeys(false)
				return
			}

			console.log('⚠️ Brak klucza w cache - pobieranie z serwera...')

			// 2. Pobierz zaszyfrowany klucz z serwera
			try {
				const response = await keysApi.getGroupKey(conversation.groupId)

				console.log('📥 Odpowiedź z serwera:', response)

				// ✅ POPRAWKA: Dane mogą być już obiektem lub stringiem JSON
				let encryptedKeyData
				if (typeof response.encryptedKey === 'string') {
					encryptedKeyData = JSON.parse(response.encryptedKey)
				} else {
					encryptedKeyData = response.encryptedKey
				}

				console.log('🔑 Zaszyfrowane dane:', encryptedKeyData)

				// 3. Pobierz klucz publiczny twórcy grupy
				const groupResponse = await groupsApi.getGroupDetails(conversation.groupId)

				if (!groupResponse.group?.creator?.public_key_dh) {
					throw new Error('Brak klucza publicznego twórcy grupy')
				}

				const creatorPublicKeyJwk = JSON.parse(groupResponse.group.creator.public_key_dh)
				console.log('👤 Klucz publiczny twórcy pobrany')

				// 4. Pobierz swój klucz prywatny
				const myPrivateKeyJwk = getPrivateKeyDHLocally()
				if (!myPrivateKeyJwk) {
					console.error('❌ Brak klucza prywatnego DH')
					setLoadingKeys(false)
					return
				}
				const myPrivateKey = await importPrivateKeyDH(myPrivateKeyJwk)
				console.log('🔑 Klucz prywatny zaimportowany')

				// 5. Import klucza publicznego twórcy
				const creatorPublicKey = await crypto.subtle.importKey(
					'jwk',
					creatorPublicKeyJwk,
					{ name: 'ECDH', namedCurve: 'P-256' },
					false,
					[]
				)

				// 6. Wylicz shared secret z twórcą grupy (ECDH)
				const sharedSecret = await crypto.subtle.deriveBits(
					{ name: 'ECDH', public: creatorPublicKey },
					myPrivateKey,
					256
				)
				console.log('🔐 Shared secret wyliczony')

				// 7. Derive AES key z shared secret
				const aesKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['decrypt'])

				// 8. ✅ Odszyfruj klucz grupowy
				const iv = Uint8Array.from(atob(encryptedKeyData.iv), c => c.charCodeAt(0))
				const ciphertext = Uint8Array.from(atob(encryptedKeyData.ciphertext), c => c.charCodeAt(0))

				const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, aesKey, ciphertext)

				// 9. ✅ Przekonwertuj odszyfrowane dane na string (to jest JWK)
				const decryptedString = new TextDecoder().decode(decryptedData)
				console.log('📝 Odszyfrowany string:', decryptedString.substring(0, 50) + '...')

				// 10. ✅ Parse JSON do obiektu JWK
				const groupKeyJwk = JSON.parse(decryptedString)
				console.log('🔑 Klucz grupowy JWK:', groupKeyJwk)

				// 11. ✅ Importuj klucz AES z JWK
				const groupKeyObject = await crypto.subtle.importKey('jwk', groupKeyJwk, { name: 'AES-GCM' }, true, [
					'encrypt',
					'decrypt',
				])

				// 12. Zapisz w cache
				cacheGroupKey(conversation.groupId, groupKeyObject)
				setGroupKey(groupKeyObject)

				console.log('✅ Klucz grupowy odszyfrowany i zaimportowany')
			} catch (error) {
				if (error.response?.status === 404) {
					console.warn('⚠️ Klucz grupowy nie istnieje - grupa nie ma szyfrowania')
				} else {
					console.error('❌ Błąd pobierania klucza grupowego:', error)
				}
				setGroupKey(null)
			}

			setLoadingKeys(false)
		} catch (error) {
			console.error('❌ Błąd inicjalizacji klucza grupowego:', error)
			setGroupKey(null)
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

			if (conversation.type === 'group') {
				if (groupKey) {
					try {
						console.log('🔐 Szyfrowanie wiadomości grupowej...')

						// 1. Zaszyfruj wiadomość kluczem grupowym (AES-GCM)
						const encrypted = await encryptGroupMessage(originalMessage, groupKey)

						// 2. Pobierz klucze publiczne wszystkich członków
						const publicKeysResponse = await keysApi.getGroupPublicKeys(conversation.groupId)
						const publicKeys = publicKeysResponse.publicKeys

						console.log(`👥 Pobrano klucze publiczne ${publicKeys.length} członków`)

						// 3. Pobierz mój klucz prywatny
						const myPrivateKeyJwk = getPrivateKeyDHLocally()
						if (!myPrivateKeyJwk) {
							throw new Error('Brak klucza prywatnego DH')
						}
						const myPrivateKey = await importPrivateKeyDH(myPrivateKeyJwk)

						// 4. Eksportuj klucz grupowy do JWK
						const groupKeyJwk = await crypto.subtle.exportKey('jwk', groupKey)

						// 5. Zaszyfruj klucz grupowy dla każdego członka
						const recipientKeys = {}
						for (const member of publicKeys) {
							try {
								const userPublicKeyJwk = JSON.parse(member.publicKey)

								// Wylicz shared secret z tym użytkownikiem
								const userPublicKey = await crypto.subtle.importKey(
									'jwk',
									userPublicKeyJwk,
									{ name: 'ECDH', namedCurve: 'P-256' },
									false,
									[]
								)

								const sharedSecret = await crypto.subtle.deriveBits(
									{ name: 'ECDH', public: userPublicKey },
									myPrivateKey,
									256
								)

								// Derive AES key z shared secret
								const aesKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, [
									'encrypt',
								])

								// Zaszyfruj klucz grupowy tym AES key
								const iv = crypto.getRandomValues(new Uint8Array(12))
								const encryptedGroupKey = await crypto.subtle.encrypt(
									{ name: 'AES-GCM', iv: iv },
									aesKey,
									new TextEncoder().encode(JSON.stringify(groupKeyJwk))
								)

								recipientKeys[member.userId] = {
									ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedGroupKey))),
									iv: btoa(String.fromCharCode(...iv)),
								}

								console.log(`✅ Klucz zaszyfrowany dla ${member.username}`)
							} catch (memberError) {
								console.error(`❌ Błąd szyfrowania dla ${member.username}:`, memberError)
							}
						}

						console.log('🔐 Encrypted data:', encrypted)
						console.log('   - ciphertext:', encrypted.ciphertext)
						console.log('   - iv:', encrypted.iv)
						console.log('📤 Sending:', JSON.stringify(encrypted))

						// 6. Wyślij zaszyfrowaną wiadomość
						socket.emit('send_group_message', {
							conversationId: conversation.conversationId,
							groupId: conversation.groupId,
							encryptedContent: JSON.stringify(encrypted),
							recipientKeys: recipientKeys,
							isEncrypted: true,
						})

						console.log('🔒 Wiadomość grupowa zaszyfrowana i wysłana')
					} catch (error) {
						console.error('❌ Błąd szyfrowania grupowego:', error)
						alert('Błąd szyfrowania wiadomości grupowej: ' + error.message)
						setSending(false)
						return
					}
				} else {
					// Bez szyfrowania
					console.warn('⚠️ Wiadomość grupowa wysłana BEZ szyfrowania')
					socket.emit('send_group_message', {
						conversationId: conversation.conversationId,
						groupId: conversation.groupId,
						content: originalMessage,
						isEncrypted: false,
					})
				}
			}

			// ✅ Wysyłanie prywatne przez Socket.io
			if (conversation.type === 'private') {
				socket.emit('send_private_message', {
					conversationId: conversation.conversationId,
					content: contentToSend,
					isEncrypted: isEncrypted,
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

			{conversation.type === 'group' && (
				<div
					style={{
						fontSize: '11px',
						color: groupKey ? '#28a745' : '#ffc107',
						display: 'flex',
						alignItems: 'center',
						gap: '5px',
					}}>
					{loadingKeys ? (
						<>⏳ Inicjalizacja kluczy grupowych...</>
					) : groupKey ? (
						<>🔒 Wiadomości szyfrowane end-to-end (Klucz grupowy AES-256)</>
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
