import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../api/authApi'
import { storage } from '../utils/storage'
import NotificationSettings from '../components/Settings/NotificationSettings'

const ProfilePage = () => {
	const navigate = useNavigate()
	const { user, logout, refreshUser } = useAuth()

	const [avatarUrl, setAvatarUrl] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')

	const [showRecoveryCode, setShowRecoveryCode] = useState(false)
	const [recoveryCode, setRecoveryCode] = useState('')

	useEffect(() => {
		// Sprawdź czy mamy zapisany recovery code w localStorage
		const savedCode = storage.getRecoveryCode()
		if (savedCode) {
			setRecoveryCode(savedCode)
		}
	}, [])

	const handleUpdateAvatar = async e => {
		e.preventDefault()

		if (!avatarUrl.trim()) {
			setError('Podaj URL awatara')
			return
		}

		try {
			setLoading(true)
			setError('')
			setSuccess('')

			await authApi.updateAvatar(avatarUrl)
			await refreshUser() // Odśwież dane użytkownika

			setSuccess('Awatar zaktualizowany pomyślnie!')
			setAvatarUrl('')
		} catch (err) {
			setError(err.response?.data?.error || 'Nie udało się zaktualizować awatara')
		} finally {
			setLoading(false)
		}
	}

	const handleDeleteAccount = async () => {
		const confirmText = prompt(
			'UWAGA: To działanie jest nieodwracalne!\n\n' +
				'Wszystkie Twoje dane zostaną usunięte:\n' +
				'- Konto użytkownika\n' +
				'- Wszystkie wiadomości\n' +
				'- Konwersacje\n' +
				'- Członkostwa w grupach\n\n' +
				'Wpisz "USUŃ KONTO" aby potwierdzić:'
		)

		if (confirmText !== 'USUŃ KONTO') {
			alert('Anulowano usuwanie konta')
			return
		}

		try {
			setLoading(true)
			await authApi.deleteAccount()
			alert('Konto zostało usunięte. Zostaniesz wylogowany.')
			logout()
			navigate('/')
		} catch (err) {
			alert('Błąd usuwania konta: ' + (err.response?.data?.error || err.message))
			setLoading(false)
		}
	}

	return (
		<div
			style={{
				padding: '20px',
				maxWidth: '800px',
				margin: '0 auto',
				minHeight: '100vh',
				backgroundColor: '#f8f9fa',
			}}>
			{/* Header */}
			<div style={{ marginBottom: '30px' }}>
				<button
					onClick={() => navigate('/chat')}
					style={{
						padding: '8px 15px',
						backgroundColor: '#6c757d',
						color: 'white',
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						marginBottom: '15px',
					}}>
					← Wróć do Czatu
				</button>
				<h1 style={{ margin: '0 0 10px 0' }}>👤 Profil Użytkownika</h1>
			</div>

			{/* Informacje o użytkowniku */}
			<div
				style={{
					backgroundColor: 'white',
					padding: '30px',
					borderRadius: '10px',
					boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
					marginBottom: '20px',
				}}>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '20px',
						marginBottom: '30px',
					}}>
					{/* Avatar */}
					<div
						style={{
							width: '80px',
							height: '80px',
							borderRadius: '50%',
							backgroundColor: user?.avatarUrl ? 'transparent' : '#007bff',
							color: 'white',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: '32px',
							fontWeight: 'bold',
							backgroundImage: user?.avatarUrl ? `url(${user.avatarUrl})` : 'none',
							backgroundSize: 'cover',
							backgroundPosition: 'center',
							border: '3px solid #e0e0e0',
						}}>
						{!user?.avatarUrl && user?.username?.charAt(0).toUpperCase()}
					</div>

					{/* Dane */}
					<div style={{ flex: 1 }}>
						<h2 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>{user?.username}</h2>
						<p style={{ margin: 0, color: '#666', fontSize: '14px' }}>ID: {user?.userId}</p>
						<p style={{ margin: '5px 0 0 0', color: '#999', fontSize: '12px' }}>
							Członek od: {new Date().toLocaleDateString('pl-PL')}
						</p>
					</div>
				</div>

				{/* Zmiana awatara */}
				<div
					style={{
						borderTop: '1px solid #e0e0e0',
						paddingTop: '20px',
					}}>
					<h3 style={{ fontSize: '18px', marginBottom: '15px' }}>🎨 Zmiana Awatara</h3>
					<form onSubmit={handleUpdateAvatar}>
						{error && (
							<div
								style={{
									backgroundColor: '#f8d7da',
									color: '#721c24',
									padding: '10px',
									borderRadius: '5px',
									marginBottom: '15px',
									fontSize: '14px',
								}}>
								{error}
							</div>
						)}

						{success && (
							<div
								style={{
									backgroundColor: '#d4edda',
									color: '#155724',
									padding: '10px',
									borderRadius: '5px',
									marginBottom: '15px',
									fontSize: '14px',
								}}>
								{success}
							</div>
						)}

						<div style={{ marginBottom: '15px' }}>
							<label
								style={{
									display: 'block',
									marginBottom: '8px',
									fontSize: '14px',
									fontWeight: '500',
								}}>
								URL Awatara:
							</label>
							<input
								type='url'
								value={avatarUrl}
								onChange={e => setAvatarUrl(e.target.value)}
								placeholder='https://example.com/avatar.jpg'
								style={{
									width: '100%',
									padding: '10px',
									borderRadius: '5px',
									border: '1px solid #ddd',
									fontSize: '14px',
								}}
							/>
							<p
								style={{
									fontSize: '12px',
									color: '#666',
									marginTop: '5px',
								}}>
								Wklej URL do obrazka (np. z imgur.com, gravatar.com)
							</p>
						</div>

						<button
							type='submit'
							disabled={loading}
							style={{
								padding: '10px 20px',
								backgroundColor: loading ? '#ccc' : '#007bff',
								color: 'white',
								border: 'none',
								borderRadius: '5px',
								cursor: loading ? 'not-allowed' : 'pointer',
								fontSize: '14px',
								fontWeight: 'bold',
							}}>
							{loading ? 'Zapisywanie...' : 'Zapisz Awatar'}
						</button>
					</form>
				</div>
			</div>

			{/* Kod odzyskiwania */}
			<div
				style={{
					backgroundColor: 'white',
					padding: '30px',
					borderRadius: '10px',
					boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
					marginBottom: '20px',
				}}>
				<h3 style={{ fontSize: '18px', marginBottom: '15px' }}>🔑 Kod Odzyskiwania Konta</h3>

				{recoveryCode ? (
					<>
						<p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
							Twój kod odzyskiwania konta. Zapisz go w bezpiecznym miejscu!
						</p>

						{!showRecoveryCode ? (
							<button
								onClick={() => setShowRecoveryCode(true)}
								style={{
									padding: '10px 20px',
									backgroundColor: '#ffc107',
									color: '#000',
									border: 'none',
									borderRadius: '5px',
									cursor: 'pointer',
									fontSize: '14px',
									fontWeight: 'bold',
								}}>
								👁️ Pokaż Kod Odzyskiwania
							</button>
						) : (
							<div>
								<div
									style={{
										backgroundColor: '#fff3cd',
										border: '2px solid #ffc107',
										padding: '15px',
										borderRadius: '8px',
										marginBottom: '15px',
									}}>
									<p
										style={{
											fontSize: '12px',
											fontFamily: 'monospace',
											wordBreak: 'break-all',
											margin: 0,
										}}>
										{recoveryCode}
									</p>
								</div>
								<button
									onClick={() => {
										navigator.clipboard.writeText(recoveryCode)
										alert('Kod skopiowany do schowka!')
									}}
									style={{
										padding: '8px 15px',
										backgroundColor: '#28a745',
										color: 'white',
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
										fontSize: '13px',
										marginRight: '10px',
									}}>
									📋 Kopiuj
								</button>
								<button
									onClick={() => setShowRecoveryCode(false)}
									style={{
										padding: '8px 15px',
										backgroundColor: '#6c757d',
										color: 'white',
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
										fontSize: '13px',
									}}>
									Ukryj
								</button>
							</div>
						)}
					</>
				) : (
					<div
						style={{
							backgroundColor: '#f8f9fa',
							padding: '20px',
							borderRadius: '8px',
							textAlign: 'center',
						}}>
						<p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
							Kod odzyskiwania nie jest dostępny w tej sesji.
						</p>
						<p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
							Kod jest wyświetlany tylko raz podczas rejestracji.
						</p>
					</div>
				)}
			</div>

			{/* Ustawienia powiadomień */}
			<div
				style={{
					marginTop: '20px',
				}}
			>
				<NotificationSettings />
			</div>

			{/* Strefa niebezpieczna */}
			<div
				style={{
					backgroundColor: '#fff5f5',
					padding: '30px',
					borderRadius: '10px',
					border: '2px solid #dc3545',
					boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
				}}>
				<h3
					style={{
						fontSize: '18px',
						marginBottom: '15px',
						color: '#dc3545',
					}}>
					⚠️ Strefa Niebezpieczna
				</h3>

				<p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
					Usunięcie konta jest <strong>nieodwracalne</strong>. Wszystkie Twoje dane zostaną permanentnie usunięte.
				</p>

				<button
					onClick={handleDeleteAccount}
					disabled={loading}
					style={{
						padding: '12px 24px',
						backgroundColor: loading ? '#ccc' : '#dc3545',
						color: 'white',
						border: 'none',
						borderRadius: '5px',
						cursor: loading ? 'not-allowed' : 'pointer',
						fontSize: '14px',
						fontWeight: 'bold',
					}}>
					🗑️ Usuń Konto Permanentnie
				</button>
			</div>

			{/* Wyloguj */}
			<div
				style={{
					marginTop: '30px',
					textAlign: 'center',
				}}>
				<button
					onClick={logout}
					style={{
						padding: '12px 30px',
						backgroundColor: '#6c757d',
						color: 'white',
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						fontSize: '14px',
						fontWeight: 'bold',
					}}>
					🚪 Wyloguj się
				</button>
			</div>
		</div>
	)
}

export default ProfilePage
