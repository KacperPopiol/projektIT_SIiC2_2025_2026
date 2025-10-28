import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import {
	hasPrivateKeyDH,
	getPrivateKeyDHLocally,
	importPrivateKeyDH,
	decryptPrivateKeyDH,
	savePrivateKeyDHLocally,
} from '../../utils/encryption'
import { keysApi } from '../../api/keysApi'

const Login = () => {
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	const { login, setPrivateKeyDH } = useAuth()
	const navigate = useNavigate()

	const handleSubmit = async e => {
		e.preventDefault()
		setError('')
		setLoading(true)

		// 1. Zaloguj użytkownika
		const result = await login(username, password)

		if (!result.success) {
			setError(result.error)
			setLoading(false)
			return
		}

		// 2. ✅ Sprawdź czy istnieje klucz prywatny lokalnie
		if (hasPrivateKeyDH()) {
			try {
				const privateKeyJwk = getPrivateKeyDHLocally()
				const privateKey = await importPrivateKeyDH(privateKeyJwk)

				// Zapisz w Context
				setPrivateKeyDH(privateKey)

				console.log('✅ Klucz prywatny DH załadowany z localStorage')
			} catch (error) {
				console.error('❌ Błąd importu klucza:', error)
			}
		} else {
			// 3. Brak klucza lokalnie - zapytaj o recovery
			const shouldRecover = confirm(
				'⚠️ Brak klucza prywatnego na tym urządzeniu.\n\n' + 'Pobrać backup z serwera? (wymagane hasło)'
			)

			if (shouldRecover) {
				await recoverPrivateKeyFromServer(password)
			} else {
				alert('❌ Bez klucza prywatnego nie możesz odszyfrować wiadomości!')
			}
		}

		setLoading(false)
		navigate('/chat')
	}

	const recoverPrivateKeyFromServer = async password => {
		try {
			console.log('📥 Pobieranie klucza prywatnego z serwera...')

			const response = await keysApi.getEncryptedPrivateKeyDH()

			if (!response.encryptedPrivateKey) {
				alert('❌ Brak backupu klucza na serwerze')
				return
			}

			// Odszyfruj hasłem
			const privateKeyString = decryptPrivateKeyDH(response.encryptedPrivateKey, password)

			if (!privateKeyString) {
				alert('❌ Nieprawidłowe hasło')
				return
			}

			// Zapisz lokalnie
			const privateKeyJwk = JSON.parse(privateKeyString)
			savePrivateKeyDHLocally(privateKeyJwk)

			// Importuj do Context
			const privateKey = await importPrivateKeyDH(privateKeyJwk)
			setPrivateKeyDH(privateKey)

			console.log('✅ Klucz prywatny odzyskany!')
			alert('✅ Klucz prywatny odzyskany!')
		} catch (error) {
			console.error('❌ Błąd odzyskiwania klucza:', error)
			alert('❌ Nie udało się odzyskać klucza')
		}
	}

	return (
		<div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto' }}>
			<h2>Logowanie</h2>

			<form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
				{error && (
					<div
						style={{
							backgroundColor: '#f8d7da',
							color: '#721c24',
							padding: '10px',
							borderRadius: '5px',
							marginBottom: '15px',
						}}>
						{error}
					</div>
				)}

				<div style={{ marginBottom: '15px' }}>
					<label style={{ display: 'block', marginBottom: '5px' }}>Nazwa użytkownika:</label>
					<input
						type="text"
						value={username}
						onChange={e => setUsername(e.target.value)}
						required
						style={{
							width: '100%',
							padding: '10px',
							borderRadius: '5px',
							border: '1px solid #ddd',
						}}
					/>
				</div>

				<div style={{ marginBottom: '15px' }}>
					<label style={{ display: 'block', marginBottom: '5px' }}>Hasło:</label>
					<input
						type="password"
						value={password}
						onChange={e => setPassword(e.target.value)}
						required
						style={{
							width: '100%',
							padding: '10px',
							borderRadius: '5px',
							border: '1px solid #ddd',
						}}
					/>
				</div>

				<button
					type="submit"
					disabled={loading}
					style={{
						width: '100%',
						padding: '12px',
						backgroundColor: loading ? '#ccc' : '#007bff',
						color: 'white',
						border: 'none',
						borderRadius: '5px',
						fontSize: '16px',
						cursor: loading ? 'not-allowed' : 'pointer',
					}}>
					{loading ? 'Logowanie...' : 'Zaloguj się'}
				</button>
			</form>

			<div style={{ marginTop: '20px', textAlign: 'center' }}>
				<p>
					Nie masz konta?{' '}
					<a href="/register" style={{ color: '#007bff' }}>
						Zarejestruj się
					</a>
				</p>
				<p style={{ marginTop: '10px' }}>
					<a href="/recover" style={{ color: '#6c757d' }}>
						Zapomniałeś hasła?
					</a>
				</p>
			</div>
		</div>
	)
}

export default Login
