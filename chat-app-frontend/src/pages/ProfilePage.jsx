import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { authApi } from '../api/authApi'
import { storage } from '../utils/storage'
import NotificationSettings from '../components/Settings/NotificationSettings'
import DisappearingMessagesSettings from '../components/Settings/DisappearingMessagesSettings'

const ProfilePage = () => {
	const navigate = useNavigate()
	const { user, logout, refreshUser } = useAuth()
	const { themeMode, setThemePreference, toggleTheme, loadingTheme, savingTheme, themeError } = useTheme()

	const [avatarUrl, setAvatarUrl] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')

	const [showRecoveryCode, setShowRecoveryCode] = useState(false)
	const [recoveryCode, setRecoveryCode] = useState('')
	const [themeInfo, setThemeInfo] = useState('')
	const [copied, setCopied] = useState(false)

	const palette = {
		accent: 'var(--color-accent)',
		accentSoft: 'var(--color-accent-soft)',
		accentText: 'var(--color-accent-contrast)',
		surface: 'var(--color-surface)',
		surfaceMuted: 'var(--card-bg)',
		border: 'var(--color-border)',
		borderStrong: 'var(--color-border-strong)',
		textPrimary: 'var(--color-text-primary)',
		textSecondary: 'var(--color-text-secondary)',
		textMuted: 'var(--color-text-muted)',
		successBg: 'var(--alert-success-bg)',
		successText: 'var(--alert-success-text)',
		dangerBg: 'var(--alert-danger-bg)',
		dangerText: 'var(--alert-danger-text)',
		infoBg: 'var(--alert-info-bg)',
		infoText: 'var(--alert-info-text)',
		warningBg: 'var(--alert-warning-bg)',
		warningText: 'var(--alert-warning-text)',
		success: 'var(--button-success-bg)',
		successHover: 'var(--button-success-hover)',
		successContrast: 'var(--button-success-text)',
		danger: 'var(--button-danger-bg)',
		dangerHover: 'var(--button-danger-hover)',
		dangerContrast: 'var(--button-danger-text)',
		secondary: 'var(--color-secondary)',
		secondaryContrast: 'var(--color-secondary-contrast)'
	}

	useEffect(() => {
		// Sprawdź czy mamy zapisany recovery code w localStorage
		const savedCode = storage.getRecoveryCode()
		if (savedCode) {
			setRecoveryCode(savedCode)
		}
	}, [])

	useEffect(() => {
		if (!loadingTheme) {
			setThemeInfo(
				themeMode === 'dark'
					? 'Ciemny motyw jest aktywny.'
					: 'Jasny motyw jest aktywny.'
			)
		}
	}, [loadingTheme, themeMode])
	const handleThemeSelect = async targetTheme => {
		if (targetTheme === themeMode) {
			return
		}

		setThemeInfo('')
		const result = await setThemePreference(targetTheme)
		if (result.success) {
			setThemeInfo(targetTheme === 'dark' ? 'Ciemny motyw został włączony.' : 'Jasny motyw został włączony.')
		}
	}

	const handleToggleTheme = async () => {
		setThemeInfo('')
		await toggleTheme()
	}


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
				backgroundColor: 'var(--color-bg)',
				color: 'var(--color-text-primary)',
			}}>
			{/* Header */}
			<div style={{ marginBottom: '30px' }}>
				<button
					onClick={() => navigate('/chat')}
					style={{
						padding: '8px 15px',
						backgroundColor: 'var(--color-secondary)',
						color: 'var(--color-secondary-contrast)',
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
					backgroundColor: 'var(--color-surface)',
					padding: '30px',
					borderRadius: '10px',
					boxShadow: 'var(--shadow-sm)',
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
							backgroundColor: user?.avatarUrl ? 'transparent' : palette.accent,
							color: user?.avatarUrl ? palette.textPrimary : palette.accentText,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: '32px',
							fontWeight: 'bold',
							border: `2px solid ${palette.border}`,
							backgroundImage: user?.avatarUrl ? `url(${user.avatarUrl})` : 'none',
							backgroundSize: 'cover',
							backgroundPosition: 'center',
						}}>
						{!user?.avatarUrl && user?.username?.charAt(0).toUpperCase()}
					</div>

					{/* Dane */}
					<div style={{ flex: 1 }}>
						<h2 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>{user?.username}</h2>
						<p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px' }}>ID: {user?.userId}</p>
						<p style={{ margin: '5px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
							Członek od: {new Date().toLocaleDateString('pl-PL')}
						</p>
					</div>
				</div>

				{/* Zmiana awatara */}
				<div
					style={{
						borderTop: '1px solid var(--color-border)',
						paddingTop: '20px',
					}}>
					<h3 style={{ fontSize: '18px', marginBottom: '15px' }}>🎨 Zmiana Awatara</h3>
					<form onSubmit={handleUpdateAvatar}>
						{error && (
							<div
								style={{
									backgroundColor: palette.dangerBg,
									color: palette.dangerText,
									padding: '10px',
									borderRadius: '5px',
									marginBottom: '15px',
									fontSize: '14px',
									border: `1px solid ${palette.border}`,
								}}>
								{error}
							</div>
						)}

						{success && (
							<div
								style={{
									backgroundColor: palette.successBg,
									color: palette.successText,
									padding: '10px',
									borderRadius: '5px',
									marginBottom: '15px',
									fontSize: '14px',
									border: `1px solid ${palette.border}`,
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
									border: `1px solid ${palette.border}`,
									fontSize: '14px',
									backgroundColor: palette.surface,
									color: palette.textPrimary,
								}}
							/>
							<p
								style={{
									fontSize: '12px',
									color: 'var(--color-text-muted)',
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
								borderRadius: '8px',
								border: 'none',
								backgroundColor: loading ? 'var(--button-secondary-bg)' : palette.accent,
								color: loading ? 'var(--button-secondary-text)' : palette.accentText,
								cursor: loading ? 'not-allowed' : 'pointer',
								transition: 'background-color 0.2s ease',
							}}>
							{loading ? 'Zapisywanie...' : 'Zapisz Awatar'}
						</button>
					</form>
				</div>
			</div>

			{/* Globalny motyw */}
			<div
				style={{
					backgroundColor: 'var(--color-surface)',
					padding: '30px',
					borderRadius: '10px',
					boxShadow: 'var(--shadow-sm)',
					marginBottom: '20px',
				}}>
				<h3 style={{ fontSize: '18px', marginBottom: '15px' }}>🌓 Motyw aplikacji</h3>
				<p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '15px' }}>
					Ustaw globalny motyw dla całej aplikacji. Motywy ustawione indywidualnie w czatach pozostaną bez zmian.
				</p>

				{themeError && (
					<div
						style={{
							backgroundColor: palette.dangerBg,
							color: palette.dangerText,
							padding: '10px',
							borderRadius: '5px',
							marginBottom: '15px',
							fontSize: '14px',
							border: `1px solid ${palette.border}`,
						}}>
						{themeError}
					</div>
				)}

				{themeInfo && !themeError && (
					<div
						style={{
							backgroundColor: palette.infoBg,
							color: palette.infoText,
							padding: '10px',
							borderRadius: '5px',
							marginBottom: '15px',
							fontSize: '14px',
							border: `1px solid ${palette.border}`,
						}}>
						{themeInfo}
					</div>
				)}

				<div
					style={{
						display: 'flex',
						gap: '15px',
						alignItems: 'center',
						flexWrap: 'wrap',
					}}>
					<button
						onClick={() => handleThemeSelect('light')}
						disabled={loadingTheme || savingTheme || themeMode === 'light'}
						style={{
							padding: '10px 20px',
							borderRadius: '8px',
							border: themeMode === 'light' ? `2px solid ${palette.accent}` : `1px solid ${palette.border}`,
							backgroundColor: themeMode === 'light' ? palette.accentSoft : palette.surface,
							color: palette.textPrimary,
							cursor: loadingTheme || savingTheme || themeMode === 'light' ? 'not-allowed' : 'pointer',
							fontWeight: 'bold',
							opacity: loadingTheme || savingTheme ? 0.7 : 1,
							transition: 'all 0.2s ease',
						}}>
						☀️ Jasny
					</button>
					<button
						onClick={() => handleThemeSelect('dark')}
						disabled={loadingTheme || savingTheme || themeMode === 'dark'}
						style={{
							padding: '10px 20px',
							borderRadius: '8px',
							border: themeMode === 'dark' ? `2px solid ${palette.accent}` : `1px solid ${palette.border}`,
							backgroundColor: themeMode === 'dark' ? palette.accentSoft : palette.surface,
							color: palette.textPrimary,
							cursor: loadingTheme || savingTheme || themeMode === 'dark' ? 'not-allowed' : 'pointer',
							fontWeight: 'bold',
							opacity: loadingTheme || savingTheme ? 0.7 : 1,
							transition: 'all 0.2s ease',
						}}>
						🌙 Ciemny
					</button>
					<button
						onClick={handleToggleTheme}
						disabled={loadingTheme || savingTheme}
						style={{
							padding: '10px 20px',
							borderRadius: '8px',
							border: `1px solid ${palette.border}`,
							backgroundColor: palette.surfaceMuted,
							color: palette.textPrimary,
							cursor: loadingTheme || savingTheme ? 'not-allowed' : 'pointer',
							fontWeight: 'bold',
							opacity: loadingTheme || savingTheme ? 0.7 : 1,
							transition: 'all 0.2s ease',
						}}>
						🔄 Przełącz motyw
					</button>
					{(loadingTheme || savingTheme) && (
						<span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
							{loadingTheme ? 'Ładowanie preferencji...' : 'Zapisywanie...'}
						</span>
					)}
				</div>
			</div>

			{/* Kod odzyskiwania */}
			<div
				style={{
					backgroundColor: palette.surface,
					padding: '30px',
					borderRadius: '10px',
					boxShadow: 'var(--shadow-sm)',
					marginBottom: '20px',
					border: `1px solid ${palette.border}`,
				}}>
				<h3 style={{ fontSize: '18px', marginBottom: '15px' }}>🔑 Kod Odzyskiwania Konta</h3>

				{recoveryCode ? (
					<>
						<p style={{ fontSize: '14px', color: palette.textMuted, marginBottom: '15px' }}>
							Twój kod odzyskiwania konta. Zapisz go w bezpiecznym miejscu!
						</p>

						{!showRecoveryCode ? (
							<button
								onClick={() => setShowRecoveryCode(true)}
								style={{
									padding: '10px 20px',
									backgroundColor: palette.warningBg,
									color: palette.warningText,
									border: 'none',
									borderRadius: '5px',
									cursor: 'pointer',
									fontSize: '14px',
									fontWeight: 'bold',
								}}
							>
								👁️ Pokaż Kod Odzyskiwania
							</button>
						) : (
							<div>
								<div
									style={{
										backgroundColor: palette.warningBg,
										border: `2px solid ${palette.border}`,
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
										setCopied(true)
									}}
									style={{
										padding: '10px 20px',
										backgroundColor: palette.accent,
										color: palette.accentText,
										border: 'none',
										borderRadius: '5px',
										fontSize: '14px',
										cursor: 'pointer',
									}}
								>
									📋 Kopiuj kod
								</button>
								{copied && <p style={{ marginTop: '10px', color: palette.successText }}>Kod skopiowany!</p>}
							</div>
						)}
					</>
				) : (
					<p style={{ fontSize: '14px', color: palette.textMuted }}>
						Brak kodu odzyskiwania. Utwórz go podczas rejestracji lub w ustawieniach bezpieczeństwa.
					</p>
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

			{/* Ustawienia znikających wiadomości */}
			<div
				style={{
					marginTop: '20px',
				}}
			>
				<DisappearingMessagesSettings />
			</div>

			{/* Strefa niebezpieczna */}
			<div
				style={{
					backgroundColor: 'rgba(220,53,69,0.1)',
					padding: '30px',
					borderRadius: '10px',
					border: '2px solid var(--color-danger)',
					boxShadow: 'var(--shadow-sm)',
				}}>
				<h3
					style={{
						fontSize: '18px',
						marginBottom: '15px',
						color: palette.danger,
					}}>
					⚠️ Strefa Niebezpieczna
				</h3>

				<p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
					Usunięcie konta jest <strong>nieodwracalne</strong>. Wszystkie Twoje dane zostaną permanentnie usunięte.
				</p>

				<button
					onClick={handleDeleteAccount}
					disabled={loading}
					style={{
						padding: '12px 24px',
						backgroundColor: loading ? 'var(--button-secondary-bg)' : palette.danger,
						color: loading ? 'var(--button-secondary-text)' : palette.dangerContrast,
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
						backgroundColor: palette.secondary,
						color: palette.secondaryContrast,
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
