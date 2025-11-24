import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { contactsApi } from '../api/contactsApi'
import { useAuth } from '../hooks/useAuth'

const ContactsPage = () => {
	const navigate = useNavigate()
	const { user } = useAuth()

	const [contacts, setContacts] = useState([])
	const [pendingInvitations, setPendingInvitations] = useState([])
	const [sentInvitations, setSentInvitations] = useState([])

	const [showGenerateCode, setShowGenerateCode] = useState(false)
	const [generatedCode, setGeneratedCode] = useState('')
	const [codeExpiry, setCodeExpiry] = useState(null)

	const [showAddContact, setShowAddContact] = useState(false)
	const [inviteCode, setInviteCode] = useState('')

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [searchQuery, setSearchQuery] = useState('')
	const [searchResults, setSearchResults] = useState([])
	const [searching, setSearching] = useState(false)

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
		danger: 'var(--button-danger-bg)',
		dangerText: 'var(--button-danger-text)',
		dangerBorder: 'var(--alert-danger-border)',
		warningBg: 'var(--alert-warning-bg)',
		warningText: 'var(--alert-warning-text)',
		warningBorder: 'var(--alert-warning-border)',
		dangerBg: 'var(--alert-danger-bg)',
		dangerTextStrong: 'var(--alert-danger-text)',
		secondary: 'var(--color-secondary)',
		secondaryContrast: 'var(--color-secondary-contrast)'
	}

	useEffect(() => {
		loadContacts()
	}, [])

	const loadContacts = async () => {
		try {
			const [contactsRes, pendingRes, sentRes] = await Promise.all([
				contactsApi.getContacts(),
				contactsApi.getPendingInvitations(),
				contactsApi.getSentInvitations(),
			])

			setContacts(contactsRes.contacts || [])
			setPendingInvitations(pendingRes.invitations || [])
			setSentInvitations(sentRes.sentInvitations || [])
		} catch (err) {
			console.error('Błąd ładowania kontaktów:', err)
			setError('Nie udało się załadować kontaktów')
		} finally {
			setLoading(false)
		}
	}

	const handleGenerateCode = async () => {
		try {
			setError('')
			const response = await contactsApi.generateInviteCode()
			setGeneratedCode(response.inviteCode)
			setCodeExpiry(new Date(response.expiresAt))
			setShowGenerateCode(true)

			// Automatycznie ukryj po 60 sekundach
			setTimeout(() => {
				setShowGenerateCode(false)
				setGeneratedCode('')
			}, 60000)
		} catch (err) {
			setError('Nie udało się wygenerować kodu')
		}
	}

	const handleSendInvitation = async e => {
		e.preventDefault()
		try {
			setError('')
			await contactsApi.sendInvitation(inviteCode)
			setShowAddContact(false)
			setInviteCode('')
			await loadContacts()
			alert('Zaproszenie wysłane pomyślnie!')
		} catch (err) {
			setError(err.response?.data?.error || 'Nie udało się wysłać zaproszenia')
		}
	}

	const handleDeleteContact = async contactId => {
		if (!confirm('Czy na pewno chcesz usunąć tego znajomego? Konwersacja zostanie zachowana.')) {
			return
		}

		try {
			await contactsApi.deleteContact(contactId)
			alert('Znajomy usunięty')
			await loadContacts() // Odśwież listę
		} catch (err) {
			alert('Błąd usuwania znajomego: ' + (err.response?.data?.error || err.message))
		}
	}

	const handleAccept = async contactId => {
		try {
			await contactsApi.acceptInvitation(contactId)
			await loadContacts()
			alert('Zaproszenie zaakceptowane!')
		} catch (err) {
			alert('Błąd akceptacji zaproszenia')
		}
	}

	const handleReject = async contactId => {
		try {
			await contactsApi.rejectInvitation(contactId)
			await loadContacts()
			alert('Zaproszenie odrzucone')
		} catch (err) {
			alert('Błąd odrzucania zaproszenia')
		}
	}

	const handleSearch = async query => {
		setSearchQuery(query)

		if (query.trim().length < 2) {
			setSearchResults([])
			return
		}

		try {
			setSearching(true)
			const response = await contactsApi.searchContact(query)
			setSearchResults(response.contacts || [])
		} catch (err) {
			console.error('Błąd wyszukiwania:', err)
			setSearchResults([])
		} finally {
			setSearching(false)
		}
	}
	if (loading) {
		return (
			<div style={{ padding: '40px', textAlign: 'center', color: palette.textMuted, backgroundColor: 'var(--color-bg)' }}>
				Ładowanie...
			</div>
		)
	}

	return (
		<div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: palette.textPrimary, backgroundColor: 'var(--color-bg)' }}>
			{/* Header */}
			<div style={{ marginBottom: '30px' }}>
				<button
					onClick={() => navigate('/chat')}
					style={{
						padding: '8px 15px',
						backgroundColor: palette.secondary,
						color: palette.secondaryContrast,
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						marginBottom: '15px',
					}}>
					← Wróć do Czatu
				</button>
				<h1>👥 Znajomi</h1>
				<p style={{ color: palette.textMuted, marginTop: '5px' }}>
					Zalogowany jako: <strong>{user?.username}</strong>
				</p>
			</div>

			{error && (
				<div
					style={{
						backgroundColor: palette.dangerBg,
						color: palette.dangerTextStrong,
						padding: '10px',
						borderRadius: '5px',
						marginBottom: '20px',
					}}>
					{error}
				</div>
			)}

			{/* Wyszukiwanie znajomych */}
			<div style={{ marginBottom: '20px' }}>
				<h3 style={{ fontSize: '16px', marginBottom: '10px' }}>🔍 Wyszukaj Znajomego</h3>
				<input
					type='text'
					value={searchQuery}
					onChange={e => handleSearch(e.target.value)}
					placeholder='Wpisz nazwę użytkownika...'
					style={{
						width: '100%',
						padding: '12px',
						borderRadius: '8px',
						border: `1px solid ${palette.border}`,
						fontSize: '14px',
						backgroundColor: palette.surface,
						color: palette.textPrimary,
					}}
				/>

				{searching && <p style={{ fontSize: '12px', color: palette.textMuted, marginTop: '10px' }}>Wyszukiwanie...</p>}

				{searchResults.length > 0 && (
					<div style={{ marginTop: '15px' }}>
						<h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Wyniki wyszukiwania:</h4>
						{searchResults.map(contact => (
							<div
								key={contact.contact_id}
								style={{
									backgroundColor: palette.surface,
									padding: '12px',
									borderRadius: '8px',
									marginBottom: '8px',
									border: `1px solid ${palette.border}`,
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
								}}>
								<div>
									<strong>{contact.contactUser?.username}</strong>
									<div style={{ fontSize: '12px', color: palette.textMuted, marginTop: '3px' }}>
										Status: {contact.status === 'accepted' ? '✅ Znajomy' : '⏳ Oczekuje'}
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				{searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
					<p style={{ fontSize: '12px', color: palette.textMuted, marginTop: '10px' }}>
						Nie znaleziono użytkownika "{searchQuery}"
					</p>
				)}
			</div>

			{/* Akcje */}
			<div
				style={{
					display: 'flex',
					gap: '10px',
					marginBottom: '30px',
					flexWrap: 'wrap',
				}}>
				<button
					onClick={handleGenerateCode}
					style={{
						padding: '12px 20px',
						backgroundColor: palette.success,
						color: palette.successText,
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						fontWeight: 'bold',
					}}>
					🔑 Wygeneruj Kod Zaproszeniowy
				</button>

				<button
					onClick={() => setShowAddContact(!showAddContact)}
					style={{
						padding: '12px 20px',
						backgroundColor: palette.accent,
						color: palette.accentText,
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						fontWeight: 'bold',
					}}>
					➕ Dodaj Znajomego (Użyj Kodu)
				</button>
			</div>

			{/* Wygenerowany kod */}
			{showGenerateCode && generatedCode && (
				<div
					style={{
						backgroundColor: palette.successBg,
						border: `2px solid ${palette.successBorder}`,
						padding: '20px',
						borderRadius: '8px',
						marginBottom: '20px',
						color: palette.successText
					}}>
					<h3>🔑 Twój Kod Zaproszeniowy:</h3>
					<div
						style={{
							fontSize: '32px',
							fontWeight: 'bold',
							fontFamily: 'monospace',
							letterSpacing: '5px',
							margin: '15px 0',
							color: palette.success,
						}}>
						{generatedCode}
					</div>
					<p style={{ fontSize: '14px', color: palette.textMuted }}>
						⏱️ Kod wygasa za: {Math.max(0, Math.floor((codeExpiry - new Date()) / 1000))} sekund
					</p>
					<p style={{ fontSize: '12px', color: palette.warningText, marginTop: '10px' }}>
						Podaj ten kod osobie, którą chcesz dodać do znajomych. Kod jest ważny przez 60 sekund!
					</p>
				</div>
			)}

			{/* Formularz dodawania znajomego */}
			{showAddContact && (
				<div
					style={{
						backgroundColor: palette.surfaceMuted,
						padding: '20px',
						borderRadius: '8px',
						marginBottom: '20px',
						border: `1px solid ${palette.border}`,
					}}>
					<h3>Dodaj Znajomego</h3>
					<form onSubmit={handleSendInvitation} style={{ marginTop: '15px' }}>
						<input
							type='text'
							value={inviteCode}
							onChange={e => setInviteCode(e.target.value.toUpperCase())}
							placeholder='Wpisz 6-znakowy kod (np. ABC123)'
							maxLength={6}
							style={{
								width: '100%',
								padding: '10px',
								fontSize: '18px',
								fontFamily: 'monospace',
								letterSpacing: '3px',
								borderRadius: '5px',
								border: `1px solid ${palette.border}`,
								textAlign: 'center',
								marginBottom: '10px',
							}}
							required
						/>
						<div style={{ display: 'flex', gap: '10px' }}>
							<button
								type='submit'
								style={{
									flex: 1,
									padding: '10px',
									backgroundColor: palette.accent,
									color: palette.accentText,
									border: 'none',
									borderRadius: '5px',
									cursor: 'pointer',
								}}>
								Wyślij Zaproszenie
							</button>
							<button
								type='button'
								onClick={() => {
									setShowAddContact(false)
									setInviteCode('')
								}}
								style={{
									padding: '10px 20px',
									backgroundColor: palette.secondary,
									color: palette.secondaryContrast,
									border: 'none',
									borderRadius: '5px',
									cursor: 'pointer',
								}}>
								Anuluj
							</button>
						</div>
					</form>
				</div>
			)}

			{/* Otrzymane zaproszenia */}
			{pendingInvitations.length > 0 && (
				<div style={{ marginBottom: '30px' }}>
					<h3>📩 Otrzymane Zaproszenia ({pendingInvitations.length})</h3>
					{pendingInvitations.map(invitation => (
						<div
							key={invitation.contact_id}
							style={{
								backgroundColor: palette.warningBg,
								padding: '15px',
								borderRadius: '8px',
								marginTop: '10px',
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								border: `1px solid ${palette.warningBorder}`,
								color: palette.warningText
							}}>
							<div>
								<strong>{invitation.contactUser?.username}</strong>
								<p style={{ fontSize: '12px', color: palette.textMuted, marginTop: '5px' }}>
									Wysłano: {new Date(invitation.created_at).toLocaleString('pl-PL')}
								</p>
							</div>
							<div style={{ display: 'flex', gap: '10px' }}>
								<button
									onClick={() => handleAccept(invitation.contact_id)}
									style={{
										padding: '8px 15px',
										backgroundColor: palette.success,
										color: palette.successText,
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
									}}>
									✅ Akceptuj
								</button>
								<button
									onClick={() => handleReject(invitation.contact_id)}
									style={{
										padding: '8px 15px',
										backgroundColor: palette.danger,
										color: palette.dangerText,
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
									}}>
									❌ Odrzuć
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Wysłane zaproszenia */}
			{sentInvitations.length > 0 && (
				<div style={{ marginBottom: '30px' }}>
					<h3>📤 Wysłane Zaproszenia ({sentInvitations.length})</h3>
					{sentInvitations.map(invitation => (
						<div
							key={invitation.contact_id}
							style={{
								backgroundColor: palette.surfaceMuted,
								padding: '15px',
								borderRadius: '8px',
								marginTop: '10px',
								border: `1px solid ${palette.border}`,
							}}>
							<strong>{invitation.contactUser?.username}</strong>
							<p style={{ fontSize: '12px', color: palette.textMuted, marginTop: '5px' }}>Oczekuje na akceptację...</p>
						</div>
					))}
				</div>
			)}

			{/* Lista znajomych */}
			{/* Lista znajomych */}
			<div style={{ backgroundColor: palette.surface, borderRadius: '8px', padding: '12px', border: `1px solid ${palette.border}` }}>
				<h3>✅ Znajomi ({contacts.length})</h3>
				{contacts.length === 0 ? (
					<p style={{ color: palette.textMuted, marginTop: '15px' }}>
						Nie masz jeszcze żadnych znajomych. Wygeneruj kod i podziel się nim z innymi!
					</p>
				) : (
					contacts.map(contact => (
						<div
							key={contact.contact_id}
							style={{
								backgroundColor: palette.surface,
								padding: '15px',
								borderRadius: '8px',
								marginTop: '10px',
								border: `1px solid ${palette.border}`,
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
							}}>
							<div style={{ flex: 1 }}>
								<strong>{contact.contactUser?.username}</strong>
								<p style={{ fontSize: '12px', color: palette.textMuted, marginTop: '5px' }}>
									Znajomy od: {new Date(contact.updated_at).toLocaleDateString('pl-PL')}
								</p>
							</div>
							<div style={{ display: 'flex', gap: '10px' }}>
								<button
									onClick={() => navigate('/chat')}
									style={{
										padding: '8px 15px',
										backgroundColor: palette.accent,
										color: palette.accentText,
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
										fontSize: '14px',
									}}>
									💬 Czat
								</button>
								<button
									onClick={() => handleDeleteContact(contact.contact_id)}
									style={{
										padding: '8px 15px',
										backgroundColor: palette.danger,
										color: palette.dangerText,
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
										fontSize: '14px',
									}}>
									🗑️ Usuń
								</button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	)
}

export default ContactsPage
