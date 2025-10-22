import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

const Login = () => {
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	const { login } = useAuth()
	const navigate = useNavigate()

	const handleSubmit = async e => {
		e.preventDefault()
		setError('')
		setLoading(true)

		const result = await login(username, password)
		setLoading(false)

		if (result.success) {
			navigate('/chat')
		} else {
			setError(result.error)
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
					<label style={{ display: 'block', marginBottom: '5px' }}>Hasło:</label>
					<input
						type='password'
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
					type='submit'
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
					<a href='/register' style={{ color: '#007bff' }}>
						Zarejestruj się
					</a>
				</p>
				<p style={{ marginTop: '10px' }}>
					<a href='/recover' style={{ color: '#6c757d' }}>
						Zapomniałeś hasła?
					</a>
				</p>
			</div>
		</div>
	)
}

export default Login
