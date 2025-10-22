import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

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
			}}>
			<h1 style={{ fontSize: '48px', marginBottom: '20px' }}>💬 Chat App</h1>
			<p style={{ fontSize: '20px', color: '#666', marginBottom: '40px' }}>
				Bezpieczna, anonimowa aplikacja do komunikacji w czasie rzeczywistym
			</p>

			<div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
				<button
					onClick={() => navigate('/login')}
					style={{
						padding: '15px 40px',
						fontSize: '18px',
						backgroundColor: '#007bff',
						color: 'white',
						border: 'none',
						borderRadius: '8px',
						cursor: 'pointer',
					}}>
					Zaloguj się
				</button>

				<button
					onClick={() => navigate('/register')}
					style={{
						padding: '15px 40px',
						fontSize: '18px',
						backgroundColor: '#28a745',
						color: 'white',
						border: 'none',
						borderRadius: '8px',
						cursor: 'pointer',
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
