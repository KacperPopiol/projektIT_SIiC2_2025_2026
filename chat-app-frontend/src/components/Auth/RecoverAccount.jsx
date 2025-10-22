import { useState } from 'react'
import { authApi } from '../../api/authApi'
import { useNavigate } from 'react-router-dom'

const RecoverAccount = () => {
	const [username, setUsername] = useState('')
	const [recoveryCode, setRecoveryCode] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [error, setError] = useState('')
	const [success, setSuccess] = useState(false)
	const [loading, setLoading] = useState(false)

	const navigate = useNavigate()

	const handleSubmit = async e => {
		e.preventDefault()
		setError('')
		setLoading(true)

		if (newPassword.length < 6) {
			setError('Nowe hasło musi mieć minimum 6 znaków')
			setLoading(false)
			return
		}

		try {
			await authApi.recoverAccount(username, recoveryCode, newPassword)
			setSuccess(true)
			setTimeout(() => {
				navigate('/login')
			}, 3000)
		} catch (error) {
			setError(error.response?.data?.error || 'Błąd odzyskiwania konta')
		} finally {
			setLoading(false)
		}
	}

	if (success) {
		return (
			<div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
				<h2>✅ Sukces!</h2>
				<p>Hasło zostało zmienione pomyślnie.</p>
				<p>Za chwilę zostaniesz przekierowany do logowania...</p>
			</div>
		)
	}

	return (
		<div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto' }}>
			<h2>Odzyskiwanie Konta</h2>

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
						type='text'
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
					<label style={{ display: 'block', marginBottom: '5px' }}>Kod odzyskiwania:</label>
					<input
						type='text'
						value={recoveryCode}
						onChange={e => setRecoveryCode(e.target.value)}
						placeholder='64-znakowy kod z rejestracji'
						required
						style={{
							width: '100%',
							padding: '10px',
							borderRadius: '5px',
							border: '1px solid #ddd',
							fontFamily: 'monospace',
						}}
					/>
				</div>

				<div style={{ marginBottom: '15px' }}>
					<label style={{ display: 'block', marginBottom: '5px' }}>Nowe hasło:</label>
					<input
						type='password'
						value={newPassword}
						onChange={e => setNewPassword(e.target.value)}
						placeholder='min. 6 znaków'
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
					type='submit'
					disabled={loading}
					style={{
						width: '100%',
						padding: '12px',
						backgroundColor: loading ? '#ccc' : '#28a745',
						color: 'white',
						border: 'none',
						borderRadius: '5px',
						fontSize: '16px',
						cursor: loading ? 'not-allowed' : 'pointer',
					}}>
					{loading ? 'Zmiana hasła...' : 'Zmień hasło'}
				</button>
			</form>

			<p style={{ marginTop: '20px', textAlign: 'center' }}>
				<a href='/login' style={{ color: '#007bff' }}>
					Wróć do logowania
				</a>
			</p>
		</div>
	)
}

export default RecoverAccount
