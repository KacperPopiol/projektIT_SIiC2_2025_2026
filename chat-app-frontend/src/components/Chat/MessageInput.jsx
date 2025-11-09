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
import FileInput from './FileInput'
import { filesApi } from '../../api/filesApi'
import { CHAT_THEMES } from '../../constants/chatThemes'

const MessageInput = ({ conversation, onMessageSent, themeVariables }) => {
	const [message, setMessage] = useState('')
	const [sending, setSending] = useState(false)
	const [sharedSecretAES, setSharedSecretAES] = useState(null)
	const [loadingKeys, setLoadingKeys] = useState(true)
	const { socket, connected } = useSocket()
	const { user, privateKeyDH } = useAuth()
	const [groupKey, setGroupKey] = useState(null)
	const typingTimeoutRef = useRef(null)
	const [selectedFiles, setSelectedFiles] = useState([])
	const [uploadingFiles, setUploadingFiles] = useState(false)
	const [uploadProgress, setUploadProgress] = useState({})
	const theme = themeVariables || CHAT_THEMES[0].variables

	// Inicjalizacja sekretów
	useEffect(() => {
		if (conversation.type === 'private' && privateKeyDH && conversation.conversationId) {
			initializeSharedSecret()
		} else if (conversation.type === 'group' && conversation.groupId) {
			initializeGroupKey()
			setLoadingKeys(false)
		}
	}, [conversation, privateKeyDH])

	// Inicjalizcja klucza dla konwersacji prywatnej
	const initializeSharedSecret = async () => {
		try {
			setLoadingKeys(true)

			let sharedSecret = await getCachedSharedSecret(conversation.conversationId)

			if (!sharedSecret) {
				console.log('Brak shared secret w cache - wyliczanie z ECDH...')

				const response = await keysApi.getConversationPublicKeys(conversation.conversationId)

				const otherUser = response.publicKeys.find(k => k.userId !== user.userId)

				if (!otherUser?.publicKey) {
					console.error('Brak klucza publicznego rozmówcy - wiadomości nie będą szyfrowane')
					setLoadingKeys(false)
					return
				}

				const otherPublicKeyJwk = JSON.parse(otherUser.publicKey)

				sharedSecret = await deriveSharedSecretAES(privateKeyDH, otherPublicKeyJwk)

				await cacheSharedSecret(conversation.conversationId, sharedSecret)

				console.log('Shared secret (klucz AES) wyliczony i zapisany')
			} else {
				console.log('Shared secret załadowany z cache')
			}

			setSharedSecretAES(sharedSecret)
		} catch (error) {
			console.error('Błąd inicjalizacji shared secret:', error)
		} finally {
			setLoadingKeys(false)
		}
	}

	// Inicjalizacja klucza grupowego
	const initializeGroupKey = async () => {
		try {
			setLoadingKeys(true)
			console.log('Inicjalizacja klucza grupowego...')

			let cachedKey = getCachedGroupKey(conversation.groupId)

			if (cachedKey) {
				setGroupKey(cachedKey)
				console.log('Klucz grupowy załadowany z cache')
				setLoadingKeys(false)
				return
			}

			console.log('Brak klucza w cache - pobieranie z serwera...')

			try {
				const response = await keysApi.getGroupKey(conversation.groupId)

				let encryptedKeyData
				if (typeof response.encryptedKey === 'string') {
					encryptedKeyData = JSON.parse(response.encryptedKey)
				} else {
					encryptedKeyData = response.encryptedKey
				}

				const groupResponse = await groupsApi.getGroupDetails(conversation.groupId)

				if (!groupResponse.group?.creator?.public_key_dh) {
					throw new Error('Brak klucza publicznego twórcy grupy')
				}

				const creatorPublicKeyJwk = JSON.parse(groupResponse.group.creator.public_key_dh)

				const myPrivateKeyJwk = getPrivateKeyDHLocally()
				if (!myPrivateKeyJwk) {
					console.error('Brak klucza prywatnego DH')
					setLoadingKeys(false)
					return
				}
				const myPrivateKey = await importPrivateKeyDH(myPrivateKeyJwk)

				const creatorPublicKey = await crypto.subtle.importKey(
					'jwk',
					creatorPublicKeyJwk,
					{ name: 'ECDH', namedCurve: 'P-256' },
					false,
					[]
				)

				const sharedSecret = await crypto.subtle.deriveBits(
					{ name: 'ECDH', public: creatorPublicKey },
					myPrivateKey,
					256
				)

				const aesKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['decrypt'])
				const iv = Uint8Array.from(atob(encryptedKeyData.iv), c => c.charCodeAt(0))
				const ciphertext = Uint8Array.from(atob(encryptedKeyData.ciphertext), c => c.charCodeAt(0))
				const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, aesKey, ciphertext)
				const decryptedString = new TextDecoder().decode(decryptedData)
				const groupKeyJwk = JSON.parse(decryptedString)

				const groupKeyObject = await crypto.subtle.importKey('jwk', groupKeyJwk, { name: 'AES-GCM' }, true, [
					'encrypt',
					'decrypt',
				])

				cacheGroupKey(conversation.groupId, groupKeyObject)
				setGroupKey(groupKeyObject)

				console.log('Klucz grupowy odszyfrowany i zaimportowany')
			} catch (error) {
				if (error.response?.status === 404) {
					console.warn('Klucz grupowy nie istnieje - grupa nie ma szyfrowania')
				} else {
					console.error('Błąd pobierania klucza grupowego:', error)
				}
				setGroupKey(null)
			}

			setLoadingKeys(false)
		} catch (error) {
			console.error('Błąd inicjalizacji klucza grupowego:', error)
			setGroupKey(null)
			setLoadingKeys(false)
		}
	}

	// Obsługa błędów z backendu
	useEffect(() => {
		if (!socket) return

		const handleError = errorData => {
			console.error('Socket error:', errorData)

			if (errorData.code === 'NOT_FRIENDS') {
				alert(
					'Nie możesz wysłać wiadomości\n\n' +
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
			console.log('Wiadomość wysłana:', data)
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

		socket.emit('typing', {
			conversationId: conversation.conversationId,
			isGroup: conversation.type === 'group',
			groupId: conversation.groupId || null,
		})

		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current)
		}

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

		// Sprawdź czy jest przynajmniej wiadomość lub pliki
		if ((!message.trim() && selectedFiles.length === 0) || !connected || sending || uploadingFiles) return

		setSending(true)
		const originalMessage = message.trim()

		try {
			socket.emit('stop_typing', {
				conversationId: conversation.conversationId,
				isGroup: conversation.type === 'group',
				groupId: conversation.groupId || null,
			})

			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current)
			}

			// Upload plików jeśli są
			let fileIds = []
			if (selectedFiles.length > 0) {
				setUploadingFiles(true)
				try {
					const uploadResponse = await filesApi.uploadFiles(conversation.conversationId, selectedFiles, progress => {
						setUploadProgress({ overall: progress })
					})
					fileIds = uploadResponse.files.map(f => f.file_id)
					setSelectedFiles([]) // Wyczyść wybrane pliki po uploadzie
					setUploadProgress({})
				} catch (uploadError) {
					console.error('Błąd uploadu plików:', uploadError)
					alert('Nie udało się przesłać plików: ' + (uploadError.response?.data?.error || uploadError.message))
					setSending(false)
					setUploadingFiles(false)
					return
				} finally {
					setUploadingFiles(false)
				}
			}

			let contentToSend = originalMessage || '[Plik]' // Jeśli tylko pliki, użyj placeholder
			let isEncrypted = false

			if (conversation.type === 'private' && sharedSecretAES && originalMessage.trim()) {
				try {
					const encrypted = await encryptMessageWithSharedSecret(originalMessage, sharedSecretAES)

					contentToSend = JSON.stringify(encrypted)
					isEncrypted = true
				} catch (encryptError) {
					console.error('Błąd szyfrowania:', encryptError)
					alert('Nie udało się zaszyfrować wiadomości')
					setSending(false)
					return
				}
			} else if (conversation.type === 'private' && !sharedSecretAES) {
				console.warn('Brak shared secret - wiadomość wysłana bez szyfrowania')
			}

			if (conversation.type === 'group') {
				if (groupKey) {
					try {
						const encrypted = await encryptGroupMessage(originalMessage, groupKey)
						const publicKeysResponse = await keysApi.getGroupPublicKeys(conversation.groupId)
						const publicKeys = publicKeysResponse.publicKeys

						const myPrivateKeyJwk = getPrivateKeyDHLocally()
						if (!myPrivateKeyJwk) {
							throw new Error('Brak klucza prywatnego DH')
						}
						const myPrivateKey = await importPrivateKeyDH(myPrivateKeyJwk)
						const groupKeyJwk = await crypto.subtle.exportKey('jwk', groupKey)

						const recipientKeys = {}
						for (const member of publicKeys) {
							try {
								const userPublicKeyJwk = JSON.parse(member.publicKey)

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

								const aesKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, [
									'encrypt',
								])

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

								console.log(`Klucz zaszyfrowany dla ${member.username}`)
							} catch (memberError) {
								console.error(`Błąd szyfrowania dla ${member.username}:`, memberError)
							}
						}

						socket.emit('send_group_message', {
							conversationId: conversation.conversationId,
							groupId: conversation.groupId,
							encryptedContent: JSON.stringify(encrypted),
							recipientKeys: recipientKeys,
							isEncrypted: true,
							fileIds: fileIds,
						})

						console.log('Wiadomość grupowa zaszyfrowana i wysłana')
					} catch (error) {
						console.error('Błąd szyfrowania grupowego:', error)
						alert('Błąd szyfrowania wiadomości grupowej: ' + error.message)
						setSending(false)
						return
					}
				} else {
					// Bez szyfrowania
					console.warn('Wiadomość grupowa wysłana BEZ szyfrowania')
					socket.emit('send_group_message', {
						conversationId: conversation.conversationId,
						groupId: conversation.groupId,
						content: originalMessage || '[Plik]',
						isEncrypted: false,
						fileIds: fileIds,
					})
				}
			}

			// Wysyłanie prywatne przez Socket.io
			if (conversation.type === 'private') {
				socket.emit('send_private_message', {
					conversationId: conversation.conversationId,
					content: contentToSend,
					isEncrypted: isEncrypted,
					fileIds: fileIds,
				})
			}

			setMessage('')

			setTimeout(() => {
				if (sending) {
					console.warn('Brak odpowiedzi z backendu - reset sending')
					setSending(false)
				}
			}, 5000)
		} catch (error) {
			console.error('Błąd wysyłania wiadomości:', error)
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
				borderTop: `1px solid ${theme.accentColor}33`,
				backgroundColor: 'rgba(255,255,255,0.92)',
				backdropFilter: 'blur(6px)',
				display: 'flex',
				flexDirection: 'column',
				gap: '10px',
			}}>
			{/* Status szyfrowania */}
			{conversation.type === 'private' && (
				<div
					style={{
						fontSize: '11px',
						color: sharedSecretAES ? theme.accentColor : '#ffc107',
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
						color: groupKey ? theme.accentColor : '#ffc107',
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

			{/* Lista wybranych plików */}
			{selectedFiles.length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
					{selectedFiles.map((file, index) => (
						<div
							key={index}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								padding: '6px 10px',
								backgroundColor: 'rgba(255,255,255,0.85)',
								border: `1px solid ${theme.accentColor}22`,
								borderRadius: '4px',
								fontSize: '12px',
							}}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
								<span style={{ fontSize: '14px' }}>
									{file.type.startsWith('image/')
										? '🖼️'
										: file.type === 'application/pdf'
											? '📄'
											: file.type.startsWith('video/')
												? '🎥'
												: file.type.startsWith('audio/')
													? '🎵'
													: '📎'}
								</span>
								<span
									style={{
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
										flex: 1,
									}}>
									{file.name}
								</span>
								<span style={{ color: '#666', fontSize: '11px', whiteSpace: 'nowrap' }}>
									({filesApi.formatFileSize(file.size)})
								</span>
							</div>
							<button
								type="button"
								onClick={e => {
									e.stopPropagation()
									const newFiles = [...selectedFiles]
									newFiles.splice(index, 1)
									setSelectedFiles(newFiles)
								}}
								style={{
									background: 'none',
									border: 'none',
									color: theme.accentColor,
									cursor: 'pointer',
									fontSize: '16px',
									padding: '0 5px',
									marginLeft: '8px',
								}}
								title="Usuń plik">
								×
							</button>
						</div>
					))}
					{selectedFiles.length > 0 && (
						<div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
							{selectedFiles.length}/5 plików
						</div>
					)}
				</div>
			)}

			{/* Progress bar dla uploadu */}
			{uploadingFiles && uploadProgress.overall !== undefined && (
				<div style={{ marginBottom: '10px' }}>
					<div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
						Przesyłanie plików: {uploadProgress.overall}%
					</div>
					<div
						style={{
							width: '100%',
							height: '8px',
							backgroundColor: '#e0e0e0',
							borderRadius: '4px',
							overflow: 'hidden',
						}}>
						<div
							style={{
								width: `${uploadProgress.overall}%`,
								height: '100%',
								backgroundColor: theme.accentColor,
								transition: 'width 0.3s',
							}}
						/>
					</div>
				</div>
			)}

			<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
				{/* FileInput - mały przycisk */}
				{!sending && !uploadingFiles && (
					<FileInput
						onFilesSelected={setSelectedFiles}
						selectedFiles={selectedFiles}
						onRemoveFile={index => {
							const newFiles = [...selectedFiles]
							newFiles.splice(index, 1)
							setSelectedFiles(newFiles)
						}}
					/>
				)}
				<input
					type="text"
					value={message}
					onChange={handleChange}
					placeholder={connected ? 'Wpisz wiadomość...' : 'Łączenie...'}
					disabled={!connected || sending || loadingKeys || uploadingFiles}
					style={{
						flex: 1,
						padding: '10px 15px',
						borderRadius: '20px',
						border: `1px solid ${theme.accentColor}33`,
						fontSize: '14px',
						outline: 'none',
						backgroundColor: sending || loadingKeys || uploadingFiles ? '#f5f5f5' : 'white',
						cursor: sending || loadingKeys || uploadingFiles ? 'not-allowed' : 'text',
					}}
				/>
				<button
					type="submit"
					disabled={(!message.trim() && selectedFiles.length === 0) || !connected || sending || loadingKeys || uploadingFiles}
					style={{
						padding: '10px 25px',
						backgroundColor:
							(!message.trim() && selectedFiles.length === 0) || !connected || sending || loadingKeys || uploadingFiles
								? '#ccc'
								: theme.accentColor,
						color: 'white',
						border: 'none',
						borderRadius: '20px',
						cursor:
							(!message.trim() && selectedFiles.length === 0) || !connected || sending || loadingKeys || uploadingFiles
								? 'not-allowed'
								: 'pointer',
						fontSize: '14px',
						fontWeight: 'bold',
						transition: 'background-color 0.2s',
					}}>
					{loadingKeys
						? '🔑 Klucze...'
						: uploadingFiles
							? `⏳ ${uploadProgress.overall || 0}%`
							: sending
								? '⏳ Wysyłanie...'
								: '📤 Wyślij'}
				</button>
			</div>
		</form>
	)
}

export default MessageInput
