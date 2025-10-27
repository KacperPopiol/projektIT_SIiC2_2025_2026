import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { keysApi } from '../../api/keysApi'
import { generateKeyPair, savePrivateKey, generatePreKeys, savePreKeys } from '../../utils/encryption'

const Register = () => {
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const [recoveryCode, setRecoveryCode] = useState('')
	const [showRecoveryCode, setShowRecoveryCode] = useState(false)

	const { register } = useAuth()
	const navigate = useNavigate()

	const handleSubmit = async e => {
		e.preventDefault()
		setError('')
		setLoading(true)

		// Walidacja
		if (username.length < 3) {
			setError('Nazwa użytkownika musi mieć minimum 3 znaki')
			setLoading(false)
			return
		}

		if (password.length < 6) {
			setError('Hasło musi mieć minimum 6 znaków')
			setLoading(false)
			return
		}

		const result = await register(username, password)
		setLoading(false)

		if (result.success) {
			console.log('🔐 Generowanie kluczy E2EE...')

			// 2. Wygeneruj parę kluczy ECDH
			const { privateKey, publicKey } = generateKeyPair()

			// 3. Wygeneruj Pre-Keys (10 sztuk)
			const preKeys = generatePreKeys(10)

			// 4. Zapisz klucz prywatny lokalnie (zaszyfrowany hasłem)
			savePrivateKey(privateKey, password)

			// 5. Zapisz Pre-Keys lokalnie
			savePreKeys(preKeys)

			console.log('📤 Wysyłanie klucza publicznego na serwer...')

			// 6. Wyślij klucz publiczny i Pre-Keys na serwer
			await keysApi.savePublicKey(publicKey, preKeys)

			console.log('✅ Klucze E2EE zapisane!')

			setRecoveryCode(result.data.recoveryCode)
			setShowRecoveryCode(true)
		} else {
			setError(result.error)
		}
	}

	const handleContinue = () => {
		navigate('/chat')
	}

	if (showRecoveryCode) {
		return (
			<div style={{ padding: '20px', maxWidth: '500px', margin: '50px auto' }}>
				<h2>🎉 Rejestracja Pomyślna!</h2>

				<div
					style={{
						backgroundColor: '#fff3cd',
						padding: '15px',
						borderRadius: '8px',
						marginTop: '20px',
						border: '2px solid #ffc107',
					}}>
					<h3>⚠️ WAŻNE - Zapisz Kod Odzyskiwania</h3>
					<p>Ten kod jest potrzebny do odzyskania konta jeśli zapomnisz hasła:</p>
					<div
						style={{
							backgroundColor: '#fff',
							padding: '15px',
							borderRadius: '5px',
							fontFamily: 'monospace',
							fontSize: '14px',
							wordBreak: 'break-all',
							marginTop: '10px',
							border: '1px solid #ddd',
						}}>
						{recoveryCode}
					</div>
					<p style={{ marginTop: '15px', fontSize: '14px', color: '#856404' }}>
						<strong>Skopiuj i zapisz ten kod w bezpiecznym miejscu!</strong>
						<br />
						Nie będziesz mógł go zobaczyć ponownie.
					</p>
				</div>

				<button
					onClick={handleContinue}
					style={{
						width: '100%',
						padding: '12px',
						marginTop: '20px',
						backgroundColor: '#28a745',
						color: 'white',
						border: 'none',
						borderRadius: '5px',
						fontSize: '16px',
						cursor: 'pointer',
					}}>
					Przejdź do Aplikacji
				</button>
			</div>
		)
	}

	return (
		<div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto' }}>
			<h2>Rejestracja</h2>

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
						placeholder="min. 3 znaki"
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
						placeholder="min. 6 znaków"
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
					{loading ? 'Rejestrowanie...' : 'Zarejestruj się'}
				</button>
			</form>

			<p style={{ marginTop: '20px', textAlign: 'center' }}>
				Masz już konto?{' '}
				<a href="/login" style={{ color: '#007bff' }}>
					Zaloguj się
				</a>
			</p>
		</div>
	)
}

export default Register
