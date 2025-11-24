import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const palette = {
	background: 'var(--color-bg)',
	surface: 'var(--card-bg)',
	textPrimary: 'var(--color-text-primary)',
	textMuted: 'var(--color-text-muted)',
	accent: 'var(--color-accent)',
	accentText: 'var(--color-accent-contrast)',
	success: 'var(--button-success-bg)',
	successText: 'var(--button-success-text)',
	border: 'var(--color-border)'
}

const HomePage = () => {
	const navigate = useNavigate()
	const { isAuthenticated } = useAuth()

	if (isAuthenticated) {
		navigate('/chat')
		return null
	}

	return (
		<div
			style={{
				padding: '50px',
				maxWidth: '800px',
				margin: '0 auto',
				textAlign: 'center',
				backgroundColor: palette.surface,
				borderRadius: '16px',
				boxShadow: 'var(--shadow-md)',
				border: `1px solid ${palette.border}`,
				color: palette.textPrimary,
			}}
		>
			<h1 style={{ fontSize: '48px', marginBottom: '20px' }}>💬 Chat App</h1>
			<p style={{ fontSize: '20px', color: palette.textMuted, marginBottom: '40px' }}>
				Bezpieczna, anonimowa aplikacja do komunikacji w czasie rzeczywistym
			</p>

			<div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
				<button
					onClick={() => navigate('/login')}
					style={{
						padding: '15px 40px',
						fontSize: '18px',
						backgroundColor: palette.accent,
						color: palette.accentText,
						border: 'none',
						borderRadius: '8px',
						cursor: 'pointer',
						boxShadow: 'var(--shadow-sm)',
					}}>
					Zaloguj się
				</button>

				<button
					onClick={() => navigate('/register')}
					style={{
						padding: '15px 40px',
						fontSize: '18px',
						backgroundColor: palette.success,
						color: palette.successText,
						border: 'none',
						borderRadius: '8px',
						cursor: 'pointer',
						boxShadow: 'var(--shadow-sm)',
					}}>
					Zarejestruj się
				</button>
			</div>

			<div style={{ marginTop: '60px', textAlign: 'left' }}>
				<h2>✨ Funkcje:</h2>
				<ul style={{ fontSize: '16px', lineHeight: '2' }}>
					<li>🔐 Anonimowe logowanie i rejestracja</li>
					<li>👥 System znajomych z kodami zaproszeń (ważne 60 sekund)</li>
					<li>💬 Wiadomości prywatne w czasie rzeczywistym</li>
					<li>🎯 Grupy z zarządzaniem członkami</li>
					<li>✅ Statusy odczytania wiadomości</li>
					<li>📦 Archiwizacja i eksport konwersacji</li>
					<li>🔒 Odzyskiwanie konta z kodem recovery</li>
				</ul>
			</div>
		</div>
	)
}

export default HomePage
