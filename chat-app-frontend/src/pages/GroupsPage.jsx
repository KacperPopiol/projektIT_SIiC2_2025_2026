import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { groupsApi } from '../api/groupsApi'
import { useAuth } from '../hooks/useAuth'
import { generateGroupKey, exportGroupKey, cacheGroupKey, getCachedGroupKey } from '../utils/groupEncryption'
import { getPrivateKeyDHLocally, importPrivateKeyDH } from '../utils/encryption'
import { keysApi } from '../api/keysApi'

const GroupsPage = () => {
	const navigate = useNavigate()
	const { user } = useAuth()

	const [groups, setGroups] = useState([])
	const [selectedGroup, setSelectedGroup] = useState(null)
	const [groupMembers, setGroupMembers] = useState([])
	const [pendingRequests, setPendingRequests] = useState([])

	const [showCreateGroup, setShowCreateGroup] = useState(false)
	const [groupName, setGroupName] = useState('')

	const [showJoinGroup, setShowJoinGroup] = useState(false)
	const [inviteCode, setInviteCode] = useState('')

	const [generatedCode, setGeneratedCode] = useState('')
	const [showGeneratedCode, setShowGeneratedCode] = useState(false)
	const [editingGroupName, setEditingGroupName] = useState(false)
	const [newGroupName, setNewGroupName] = useState('')

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const palette = {
		accent: 'var(--color-accent)',
		accentText: 'var(--color-accent-contrast)',
		surface: 'var(--color-surface)',
		surfaceMuted: 'var(--card-bg)',
		border: 'var(--color-border)',
		textPrimary: 'var(--color-text-primary)',
		textSecondary: 'var(--color-text-secondary)',
		textMuted: 'var(--color-text-muted)',
		success: 'var(--button-success-bg)',
		successText: 'var(--button-success-text)',
		successBorder: 'var(--alert-success-border)',
		successBg: 'var(--alert-success-bg)',
		successToneText: 'var(--alert-success-text)',
		danger: 'var(--button-danger-bg)',
		dangerText: 'var(--button-danger-text)',
		dangerBorder: 'var(--alert-danger-border)',
		warning: 'var(--color-warning)',
		warningBg: 'var(--alert-warning-bg)',
		warningText: 'var(--alert-warning-text)',
		warningBorder: 'var(--alert-warning-border)',
		info: 'var(--color-info)',
		infoText: 'var(--color-info-contrast)',
		secondary: 'var(--color-secondary)',
		secondaryText: 'var(--color-secondary-contrast)'
	}

	useEffect(() => {
		loadGroups()
	}, [])

	useEffect(() => {
		const interval = setInterval(() => {
			console.log('🔄 Auto-refreshing groups...')
			loadGroups()
			if (selectedGroup) {
				loadGroupDetails(selectedGroup.group_id)
			}
		}, 3000) // 3 sekundy

		return () => clearInterval(interval)
	}, [selectedGroup])

	useEffect(() => {
		if (selectedGroup) {
			loadGroupDetails(selectedGroup.group_id)
		}
	}, [selectedGroup])

	const loadGroups = async () => {
		try {
			const response = await groupsApi.getMyGroups()
			setGroups(response.groups || [])
		} catch (err) {
			console.error('Błąd ładowania grup:', err)
			setError('Nie udało się załadować grup')
		} finally {
			setLoading(false)
		}
	}

	const isGroupCreator = groupId => {
		const groupMember = groups.find(g => g.group_id === groupId)
		return groupMember?.role === 'creator'
	}

	const loadGroupDetails = async groupId => {
		try {
			// 1. Zawsze pobierz członków (każdy członek ma dostęp)
			const membersRes = await groupsApi.getGroupMembers(groupId)
			setGroupMembers(membersRes.members || [])

			// 2. ✅ NOWE: Automatycznie załaduj klucz grupowy (jeśli istnieje)
			try {
				await loadGroupKeyIfNeeded(groupId)
			} catch (keyError) {
				console.warn('⚠️ Nie udało się załadować klucza grupowego:', keyError)
				// Nie blokuj ładowania szczegółów grupy
			}

			// 3. Pobierz oczekujące prośby TYLKO jeśli jesteś twórcą
			if (isGroupCreator(groupId)) {
				try {
					const pendingRes = await groupsApi.getPendingRequests(groupId)
					setPendingRequests(pendingRes.pendingRequests || [])
				} catch (err) {
					console.log('Nie można pobrać oczekujących próśb (brak uprawnień)')
					setPendingRequests([])
				}
			} else {
				setPendingRequests([])
			}
		} catch (err) {
			console.error('Błąd ładowania szczegółów grupy:', err)
		}
	}

	/**
	 * Automatycznie inicjalizuje szyfrowanie dla nowo utworzonej grupy
	 */
	const initializeGroupEncryptionAuto = async groupId => {
		try {
			console.log('🔐 Automatyczna inicjalizacja szyfrowania dla grupy:', groupId)

			// 1. Pobierz członków grupy (na razie tylko twórca)
			const membersResponse = await groupsApi.getGroupMembers(groupId)
			const members = membersResponse.members

			console.log(`👥 Znaleziono ${members.length} członków`)

			// 2. Wygeneruj klucz grupowy (AES-256)
			const groupKey = await generateGroupKey()
			const groupKeyJwk = await exportGroupKey(groupKey)

			console.log('🔑 Klucz grupowy wygenerowany')

			// 3. Pobierz własny klucz prywatny ECDH
			const myPrivateKeyJwk = getPrivateKeyDHLocally()
			if (!myPrivateKeyJwk) {
				throw new Error('Brak klucza prywatnego DH - zaloguj się ponownie')
			}
			const myPrivateKey = await importPrivateKeyDH(myPrivateKeyJwk)

			// 4. Zaszyfruj klucz grupowy dla każdego członka
			const encryptedKeys = []

			for (const member of members) {
				try {
					// Pobierz klucz publiczny członka
					const userKeyResponse = await keysApi.getPublicKeyDH(member.user_id)
					const userPublicKeyJwk = JSON.parse(userKeyResponse.publicKey)

					// Import klucza publicznego członka
					const userPublicKey = await crypto.subtle.importKey(
						'jwk',
						userPublicKeyJwk,
						{ name: 'ECDH', namedCurve: 'P-256' },
						false,
						[]
					)

					// Wylicz shared secret (ECDH)
					const sharedSecret = await crypto.subtle.deriveBits(
						{ name: 'ECDH', public: userPublicKey },
						myPrivateKey,
						256
					)

					// Derive AES key z shared secret
					const aesKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['encrypt'])

					// Zaszyfruj klucz grupowy tym AES key
					const iv = crypto.getRandomValues(new Uint8Array(12))
					const encryptedGroupKey = await crypto.subtle.encrypt(
						{ name: 'AES-GCM', iv: iv },
						aesKey,
						new TextEncoder().encode(JSON.stringify(groupKeyJwk))
					)

					// Dodaj do listy
					encryptedKeys.push({
						userId: member.user_id,
						encryptedKey: JSON.stringify({
							ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedGroupKey))),
							iv: btoa(String.fromCharCode(...iv)),
						}),
					})

					console.log(`✅ Klucz zaszyfrowany dla ${member.user.username}`)
				} catch (memberError) {
					console.error(`❌ Błąd szyfrowania dla członka ${member.user_id}:`, memberError)
				}
			}

			// 5. Wyślij zaszyfrowane klucze do backendu
			await groupsApi.initializeGroupEncryption(groupId, encryptedKeys)

			// 6. Zapisz klucz grupowy lokalnie
			await cacheGroupKey(groupId, groupKey)

			console.log('✅ Szyfrowanie grupowe zainicjalizowane automatycznie')
			return true
		} catch (error) {
			console.error('❌ Błąd automatycznej inicjalizacji szyfrowania:', error)
			throw error
		}
	}

	const addGroupKeyForNewMember = async (groupId, memberId) => {
		try {
			console.log(`🔑 Dodawanie klucza dla nowego członka ${memberId}`)

			// 1. Pobierz klucz grupowy z cache
			let groupKey = getCachedGroupKey(groupId)

			if (!groupKey) {
				console.warn('⚠️ Brak klucza grupowego w cache - pobieranie z serwera')
				groupKey = await loadGroupKeyIfNeeded(groupId)
			}

			// 2. Eksportuj klucz grupowy
			const groupKeyJwk = await exportGroupKey(groupKey)

			// 3. Pobierz klucz publiczny nowego członka
			const userKeyResponse = await keysApi.getPublicKeyDH(memberId)
			const userPublicKeyJwk = JSON.parse(userKeyResponse.publicKey)

			// 4. Pobierz własny klucz prywatny
			const myPrivateKeyJwk = getPrivateKeyDHLocally()
			if (!myPrivateKeyJwk) {
				throw new Error('Brak klucza prywatnego DH')
			}
			const myPrivateKey = await importPrivateKeyDH(myPrivateKeyJwk)

			// 5. Import klucza publicznego członka
			const userPublicKey = await crypto.subtle.importKey(
				'jwk',
				userPublicKeyJwk,
				{ name: 'ECDH', namedCurve: 'P-256' },
				false,
				[]
			)

			// 6. Wylicz shared secret
			const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: userPublicKey }, myPrivateKey, 256)

			// 7. Derive AES key
			const aesKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['encrypt'])

			// 8. Zaszyfruj klucz grupowy
			const iv = crypto.getRandomValues(new Uint8Array(12))
			const encryptedGroupKey = await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv: iv },
				aesKey,
				new TextEncoder().encode(JSON.stringify(groupKeyJwk))
			)

			const encryptedKeyData = JSON.stringify({
				ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedGroupKey))),
				iv: btoa(String.fromCharCode(...iv)),
			})

			// 9. Wyślij do backendu
			await groupsApi.addKeyForMember(groupId, memberId, encryptedKeyData)

			console.log(`✅ Klucz dodany dla członka ${memberId}`)
			return true
		} catch (error) {
			console.error(`❌ Błąd dodawania klucza dla członka ${memberId}:`, error)
			throw error
		}
	}

	const loadGroupKeyIfNeeded = async groupId => {
		try {
			console.log(`🔑 Sprawdzanie klucza grupowego dla grupy ${groupId}`)

			// 1. Sprawdź cache lokalny
			let groupKey = await getCachedGroupKey(groupId)

			if (groupKey) {
				console.log(`✅ Klucz grupowy załadowany z cache dla grupy ${groupId}`)
				return groupKey
			}

			console.log(`⚠️ Brak klucza w cache - pobieranie z serwera...`)

			// 2. Pobierz zaszyfrowany klucz z serwera
			try {
				const response = await keysApi.getGroupKey(groupId)

				if (!response.encryptedKey) {
					console.warn(`⚠️ Grupa ${groupId} nie ma skonfigurowanego szyfrowania`)
					return null
				}

				// 3. Parse zaszyfrowanych danych
				let encryptedKeyData
				if (typeof response.encryptedKey === 'string') {
					encryptedKeyData = JSON.parse(response.encryptedKey)
				} else {
					encryptedKeyData = response.encryptedKey
				}

				console.log(`🔐 Zaszyfrowany klucz pobrany z serwera`)

				// 4. Pobierz klucz publiczny twórcy grupy
				const groupDetails = await groupsApi.getGroupDetails(groupId)

				if (!groupDetails.group?.creator?.public_key_dh) {
					throw new Error('Brak klucza publicznego twórcy grupy')
				}

				const creatorPublicKeyJwk = JSON.parse(groupDetails.group.creator.public_key_dh)
				console.log(`👤 Klucz publiczny twórcy pobrany`)

				// 5. Pobierz własny klucz prywatny
				const myPrivateKeyJwk = getPrivateKeyDHLocally()
				if (!myPrivateKeyJwk) {
					throw new Error('Brak klucza prywatnego DH')
				}
				const myPrivateKey = await importPrivateKeyDH(myPrivateKeyJwk)
				console.log(`🔑 Klucz prywatny zaimportowany`)

				// 6. Import klucza publicznego twórcy
				const creatorPublicKey = await crypto.subtle.importKey(
					'jwk',
					creatorPublicKeyJwk,
					{ name: 'ECDH', namedCurve: 'P-256' },
					false,
					[]
				)

				// 7. Wylicz shared secret z twórcą grupy (ECDH)
				const sharedSecret = await crypto.subtle.deriveBits(
					{ name: 'ECDH', public: creatorPublicKey },
					myPrivateKey,
					256
				)
				console.log(`🔐 Shared secret wyliczony`)

				// 8. Derive AES key z shared secret
				const aesKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'AES-GCM' }, false, ['decrypt'])

				// 9. Odszyfruj klucz grupowy
				const iv = Uint8Array.from(atob(encryptedKeyData.iv), c => c.charCodeAt(0))
				const ciphertext = Uint8Array.from(atob(encryptedKeyData.ciphertext), c => c.charCodeAt(0))

				const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, aesKey, ciphertext)

				// 10. Przekonwertuj odszyfrowane dane na string (to jest JWK)
				const decryptedString = new TextDecoder().decode(decryptedData)
				console.log(`📝 Odszyfrowano klucz grupowy`)

				// 11. Parse JSON do obiektu JWK
				const groupKeyJwk = JSON.parse(decryptedString)

				// 12. Importuj klucz AES z JWK
				const groupKeyObject = await crypto.subtle.importKey('jwk', groupKeyJwk, { name: 'AES-GCM' }, true, [
					'encrypt',
					'decrypt',
				])

				// 13. Zapisz w cache
				await cacheGroupKey(groupId, groupKeyObject)

				console.log(`✅ Klucz grupowy odszyfrowany i zapisany dla grupy ${groupId}`)
				return groupKeyObject
			} catch (error) {
				if (error.response?.status === 404) {
					console.warn(`⚠️ Klucz grupowy nie istnieje dla grupy ${groupId}`)
					return null
				}
				throw error
			}
		} catch (error) {
			console.error(`❌ Błąd ładowania klucza grupowego dla grupy ${groupId}:`, error)
			throw error
		}
	}

	const handleCreateGroup = async e => {
		e.preventDefault()
		try {
			setError('')

			console.log('📝 Tworzenie grupy:', groupName)

			// 1. Utwórz grupę
			const response = await groupsApi.createGroup(groupName)
			const newGroupId = response.group.groupId

			console.log('✅ Grupa utworzona:', newGroupId)

			setShowCreateGroup(false)
			setGroupName('')

			// 2. ✅ Automatycznie zainicjalizuj szyfrowanie
			try {
				await initializeGroupEncryptionAuto(newGroupId)
				alert('✅ Grupa utworzona i zabezpieczona end-to-end!')
			} catch (encryptError) {
				console.error('⚠️ Błąd inicjalizacji szyfrowania:', encryptError)
				alert('⚠️ Grupa utworzona, ale nie udało się skonfigurować szyfrowania.\nMożesz to zrobić później ręcznie.')
			}

			// 3. Odśwież listę grup
			await loadGroups()
		} catch (err) {
			setError(err.response?.data?.error || 'Nie udało się utworzyć grupy')
		}
	}

	const handleGenerateInvite = async groupId => {
		try {
			const response = await groupsApi.generateGroupInvite(groupId)
			setGeneratedCode(response.inviteCode)
			setShowGeneratedCode(true)

			setTimeout(() => {
				setShowGeneratedCode(false)
				setGeneratedCode('')
			}, 60000)
		} catch (err) {
			alert('Błąd generowania kodu')
		}
	}

	const handleJoinGroup = async e => {
		e.preventDefault()
		try {
			setError('')
			await groupsApi.requestJoinGroup(inviteCode)
			setShowJoinGroup(false)
			setInviteCode('')
			alert('Prośba o dołączenie wysłana!')
			await loadGroups()
		} catch (err) {
			setError(err.response?.data?.error || 'Nie udało się dołączyć do grupy')
		}
	}

	const handleAcceptMember = async (groupId, memberId) => {
		try {
			setLoading(true)

			await groupsApi.acceptMember(groupId, memberId)

			try {
				await addGroupKeyForNewMember(groupId, memberId)
				alert('✅ Członek zaakceptowany i otrzymał klucz szyfrowania!')
			} catch (keyError) {
				console.error('⚠️ Błąd dodawania klucza:', keyError)
				alert('⚠️ Członek zaakceptowany, ale nie udało się dodać klucza szyfrowania')
			}

			await loadGroupDetails(groupId)
		} catch (error) {
			alert('Błąd akceptacji: ' + (error.response?.data?.error || error.message))
		} finally {
			setLoading(false)
		}
	}

	const handleRejectMember = async (groupId, memberId) => {
		try {
			await groupsApi.rejectMember(groupId, memberId)
			alert('Prośba odrzucona')
			await loadGroupDetails(groupId)
		} catch (err) {
			alert('Błąd odrzucania prośby')
		}
	}

	const handleRemoveMember = async (groupId, memberId) => {
		if (!confirm('Czy na pewno chcesz usunąć tego członka?')) return

		try {
			await groupsApi.removeMember(groupId, memberId)
			alert('Członek usunięty')
			loadGroupDetails(groupId)
		} catch (err) {
			alert('Błąd usuwania członka')
		}
	}

	const handleLeaveGroup = async groupId => {
		if (!confirm('Czy na pewno chcesz opuścić tę grupę?')) return

		try {
			await groupsApi.leaveGroup(groupId)
			alert('Opuściłeś grupę')
			setSelectedGroup(null)
			loadGroups()
		} catch (err) {
			alert('Błąd opuszczania grupy')
		}
	}

	const handleDeleteGroup = async groupId => {
		if (!confirm('Czy na pewno chcesz usunąć tę grupę? Wszystkie wiadomości zostaną usunięte!')) return

		try {
			await groupsApi.deleteGroup(groupId)
			alert('Grupa usunięta')
			setSelectedGroup(null)
			loadGroups()
		} catch (err) {
			alert('Błąd usuwania grupy')
		}
	}

	const handleUpdateGroupName = async (groupId, newName) => {
		if (!newName.trim()) {
			alert('Nazwa nie może być pusta')
			return
		}

		try {
			await groupsApi.updateGroupName(groupId, newName)

			// Odśwież dane
			await loadGroups()

			// Zaktualizuj wybraną grupę
			setSelectedGroup(prev => ({
				...prev,
				group_name: newName,
			}))

			alert('Nazwa grupy zaktualizowana!')
		} catch (err) {
			alert('Błąd zmiany nazwy: ' + (err.response?.data?.error || err.message))
		}
	}

	if (loading) {
		return (
			<div style={{ padding: '20px', color: palette.textMuted }}>
				Ładowanie...
			</div>
		)
	}

	return (
		<div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--color-bg)', color: palette.textPrimary }}>
			{/* Sidebar - Lista grup */}
			<div
				style={{
					width: '300px',
					borderRight: `1px solid ${palette.border}`,
					backgroundColor: palette.surfaceMuted,
					overflowY: 'auto',
					padding: '20px',
					boxShadow: 'var(--shadow-sm)',
				}}>
				<button
					onClick={() => navigate('/chat')}
					style={{
						width: '100%',
						padding: '10px',
						backgroundColor: palette.secondary,
						color: palette.secondaryText,
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						marginBottom: '15px',
					}}>
					← Wróć do Czatu
				</button>

				<h2>🎯 Grupy</h2>
				<p style={{ fontSize: '12px', color: palette.textMuted, marginBottom: '20px' }}>{user?.username}</p>

				<button
					onClick={() => setShowCreateGroup(!showCreateGroup)}
					style={{
						width: '100%',
						padding: '12px',
						backgroundColor: palette.success,
						color: palette.successText,
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						marginBottom: '10px',
						fontWeight: 'bold',
					}}>
					➕ Utwórz Grupę
				</button>

				<button
					onClick={() => setShowJoinGroup(!showJoinGroup)}
					style={{
						width: '100%',
						padding: '12px',
						backgroundColor: palette.accent,
						color: palette.accentText,
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						marginBottom: '20px',
						fontWeight: 'bold',
					}}>
					🔑 Dołącz do Grupy
				</button>

				{/* Formularz tworzenia grupy */}
				{showCreateGroup && (
					<form onSubmit={handleCreateGroup} style={{ marginBottom: '20px' }}>
						<input
							type="text"
							value={groupName}
							onChange={e => setGroupName(e.target.value)}
							placeholder="Nazwa grupy"
							style={{
								width: '100%',
								padding: '10px',
								borderRadius: '5px',
								border: `1px solid ${palette.border}`,
								marginBottom: '10px',
								backgroundColor: palette.surface,
								color: palette.textPrimary,
							}}
							required
						/>
						<button
							type="submit"
							style={{
								width: '100%',
								padding: '10px',
								backgroundColor: palette.success,
								color: palette.successText,
								border: 'none',
								borderRadius: '5px',
								cursor: 'pointer',
							}}>
							Utwórz
						</button>
					</form>
				)}

				{/* Formularz dołączania do grupy */}
				{showJoinGroup && (
					<form onSubmit={handleJoinGroup} style={{ marginBottom: '20px' }}>
						<input
							type="text"
							value={inviteCode}
							onChange={e => setInviteCode(e.target.value.toUpperCase())}
							placeholder="Kod zaproszenia"
							maxLength={6}
							style={{
								width: '100%',
								padding: '10px',
								borderRadius: '5px',
								border: `1px solid ${palette.border}`,
								marginBottom: '10px',
								textAlign: 'center',
								fontFamily: 'monospace',
								letterSpacing: '3px',
								backgroundColor: palette.surface,
								color: palette.textPrimary,
							}}
							required
						/>
						<button
							type="submit"
							style={{
								width: '100%',
								padding: '10px',
								backgroundColor: palette.accent,
								color: palette.accentText,
								border: 'none',
								borderRadius: '5px',
								cursor: 'pointer',
							}}>
							Dołącz
						</button>
					</form>
				)}

				{error && (
					<div
						style={{
							backgroundColor: palette.dangerBg,
							color: palette.dangerText,
							padding: '10px',
							borderRadius: '5px',
							marginBottom: '15px',
							fontSize: '12px',
							border: `1px solid ${palette.dangerBorder}`,
						}}>
						{error}
					</div>
				)}

				<h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Twoje Grupy</h3>
				{groups.length === 0 ? (
					<p style={{ fontSize: '12px', color: palette.textMuted }}>Brak grup</p>
				) : (
					groups.map(groupMember => {
						const group = groupMember.group
						const isSelected = selectedGroup?.group_id === group.group_id
						return (
							<div
								key={group.group_id}
								onClick={() => setSelectedGroup(group)}
								style={{
									padding: '12px',
									backgroundColor: isSelected ? palette.accent : palette.surface,
									color: isSelected ? palette.accentText : palette.textPrimary,
									borderRadius: '5px',
									cursor: 'pointer',
									marginBottom: '8px',
									border: `1px solid ${palette.border}`,
									boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
								}}
							>
								<strong>{group.group_name}</strong>
								<div style={{ fontSize: '11px', color: isSelected ? palette.accentText : palette.textMuted, marginTop: '5px' }}>
									{groupMember.role === 'creator' ? '👑 Twórca' : '👤 Członek'}
								</div>
							</div>
						)
					})
				)}
			</div>

			{/* Szczegóły grupy */}
			<div
				style={{
					flex: 1,
					padding: '20px',
					overflowY: 'auto',
					backgroundColor: palette.surface,
					borderTopRightRadius: '16px',
					borderBottomRightRadius: '16px',
					boxShadow: 'var(--shadow-md)'
				}}>
				{selectedGroup ? (
					<>
						{/* <h2>{selectedGroup.group_name}</h2> */}
						{editingGroupName ? (
							<div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
								<input
									type="text"
									value={newGroupName}
									onChange={e => setNewGroupName(e.target.value)}
									placeholder="Nowa nazwa grupy"
									style={{
										flex: 1,
										padding: '10px',
										borderRadius: '5px',
										border: `1px solid ${palette.border}`,
										fontSize: '16px',
										backgroundColor: palette.surface,
										color: palette.textPrimary,
									}}
									autoFocus
								/>
								<button
									onClick={async () => {
										if (newGroupName.trim()) {
											await handleUpdateGroupName(selectedGroup.group_id, newGroupName)
											setEditingGroupName(false)
											setNewGroupName('')
										}
									}}
									style={{
										padding: '10px 20px',
										backgroundColor: palette.success,
										color: palette.successText,
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
									}}>
									✓ Zapisz
								</button>
								<button
									onClick={() => {
										setEditingGroupName(false)
										setNewGroupName('')
									}}
									style={{
										padding: '10px 20px',
										backgroundColor: palette.secondary,
										color: palette.secondaryText,
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
									}}>
									✕ Anuluj
								</button>
							</div>
						) : (
							<div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
								<h2 style={{ margin: 0 }}>{selectedGroup.group_name}</h2>
								{isGroupCreator(selectedGroup.group_id) && (
									<button
										onClick={() => {
											setNewGroupName(selectedGroup.group_name)
											setEditingGroupName(true)
										}}
										style={{
											padding: '6px 12px',
											backgroundColor: palette.info,
											color: palette.infoText,
											border: 'none',
											borderRadius: '5px',
											cursor: 'pointer',
											fontSize: '13px',
										}}>
										✏️ Zmień nazwę
									</button>
								)}
							</div>
						)}

						{/* Kod zaproszeniowy */}
						{showGeneratedCode && generatedCode && (
							<div
								style={{
									backgroundColor: palette.successBg,
									border: `2px solid ${palette.successBorder}`,
									padding: '15px',
									borderRadius: '8px',
									marginBottom: '20px',
									color: palette.successToneText,
						}}>
							<h4>Kod Zaproszeniowy:</h4>
							<div
								style={{
									fontSize: '24px',
									fontWeight: 'bold',
									fontFamily: 'monospace',
									letterSpacing: '5px',
									margin: '10px 0',
								}}
							>
								{generatedCode}
							</div>
							<p style={{ fontSize: '12px', color: palette.textMuted }}>Ważny przez 60 sekund!</p>
						</div>
					)}

						{/* Akcje twórcy */}
						{groups.find(g => g.group_id === selectedGroup.group_id)?.role === 'creator' && (
							<div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
								<button
									onClick={() => handleGenerateInvite(selectedGroup.group_id)}
									style={{
										padding: '10px 15px',
										backgroundColor: palette.success,
										color: palette.successText,
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
							}}>
								🔑 Generuj Kod
							</button>
							<button
								onClick={() => handleDeleteGroup(selectedGroup.group_id)}
								style={{
									padding: '10px 15px',
									backgroundColor: palette.danger,
									color: palette.dangerText,
									border: 'none',
									borderRadius: '5px',
									cursor: 'pointer',
							}}>
								🗑️ Usuń Grupę
							</button>
						</div>
					)}

						{/* Akcje członka */}
						{groups.find(g => g.group_id === selectedGroup.group_id)?.role === 'member' && (
							<button
								onClick={() => handleLeaveGroup(selectedGroup.group_id)}
								style={{
									padding: '10px 15px',
									backgroundColor: palette.warning,
									color: palette.textPrimary,
									border: 'none',
									borderRadius: '5px',
									cursor: 'pointer',
									marginBottom: '20px',
						}}>
							🚪 Opuść Grupę
						</button>
					)}

						{/* Oczekujące prośby (tylko twórca) */}
						{pendingRequests.length > 0 &&
							groups.find(g => g.group_id === selectedGroup.group_id)?.role === 'creator' && (
								<div style={{ marginBottom: '30px' }}>
									<h3>📩 Oczekujące Prośby ({pendingRequests.length})</h3>
									{pendingRequests.map(request => (
										<div
											key={request.member_id}
											style={{
												backgroundColor: palette.warningBg,
												padding: '15px',
												borderRadius: '8px',
												marginTop: '10px',
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												border: `1px solid ${palette.warningBorder}`,
											}}
										>
											<strong>{request.user?.username}</strong>
											<div style={{ display: 'flex', gap: '10px' }}>
												<button
													onClick={() => handleAcceptMember(selectedGroup.group_id, request.user_id)}
													style={{
														padding: '8px 15px',
														backgroundColor: palette.success,
														color: palette.successText,
														border: 'none',
														borderRadius: '5px',
														cursor: 'pointer',
													}}
												>
													✅ Akceptuj
												</button>
												<button
													onClick={() => handleRejectMember(selectedGroup.group_id, request.user_id)}
													style={{
														padding: '8px 15px',
														backgroundColor: palette.danger,
														color: palette.dangerText,
														border: 'none',
														borderRadius: '5px',
														cursor: 'pointer',
													}}
												>
													❌ Odrzuć
												</button>
											</div>
										</div>
									))}
								</div>
							)}

						{/* Członkowie */}
						<div>
							<h3>👥 Członkowie ({groupMembers.length})</h3>
							{groupMembers.map(member => (
								<div
									key={member.member_id}
									style={{
										backgroundColor: palette.surface,
										padding: '15px',
										borderRadius: '8px',
										marginTop: '10px',
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										border: `1px solid ${palette.border}`,
									}}
								>
									<div>
										<strong>{member.user?.username}</strong>
										<div style={{ fontSize: '12px', color: palette.textMuted, marginTop: '5px' }}>
											{member.role === 'creator' ? '👑 Twórca' : '👤 Członek'}
										</div>
									</div>
									{member.role !== 'creator' &&
										groups.find(g => g.group_id === selectedGroup.group_id)?.role === 'creator' && (
											<button
												onClick={() => handleRemoveMember(selectedGroup.group_id, member.user_id)}
												style={{
													padding: '8px 15px',
													backgroundColor: palette.danger,
													color: palette.dangerText,
													border: 'none',
													borderRadius: '5px',
													cursor: 'pointer',
												}}
											>
												Usuń
											</button>
										)}
								</div>
							))}
						</div>
					</>
				) : (
					<div
						style={{
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							height: '100%',
							color: palette.textMuted,
						}}>
						<p>Wybierz grupę aby zobaczyć szczegóły</p>
					</div>
				)}
			</div>
		</div>
	)
}

export default GroupsPage
