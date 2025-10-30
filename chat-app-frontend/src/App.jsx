import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import { NotificationProvider } from './contexts/NotificationContext'
import ProtectedRoute from './components/Common/ProtectedRoute'
import ContactsPage from './pages/ContactsPage'
import GroupsPage from './pages/GroupsPage'
import ProfilePage from './pages/ProfilePage'
// Pages
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChatPage from './pages/ChatPage'

// Auth components
import RecoverAccount from './components/Auth/RecoverAccount'

function App() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<SocketProvider>
					<NotificationProvider>
						<Routes>
						{/* Publiczne trasy */}
						<Route path='/' element={<HomePage />} />
						<Route path='/login' element={<LoginPage />} />
						<Route path='/register' element={<RegisterPage />} />
						<Route path='/recover' element={<RecoverAccount />} />

						{/* Chronione trasy (wymagają logowania) */}
						<Route
							path='/chat'
							element={
								<ProtectedRoute>
									<ChatPage />
								</ProtectedRoute>
							}
						/>
						<Route
							path='/profile'
							element={
								<ProtectedRoute>
									<ProfilePage />
								</ProtectedRoute>
							}
						/>
						<Route
							path='/contacts'
							element={
								<ProtectedRoute>
									<ContactsPage />
								</ProtectedRoute>
							}
						/>

						<Route
							path='/groups'
							element={
								<ProtectedRoute>
									<GroupsPage />
								</ProtectedRoute>
							}
						/>

						{/* Przekierowanie dla nieistniejących tras */}
						<Route path='*' element={<Navigate to='/' replace />} />
					</Routes>
					</NotificationProvider>
				</SocketProvider>
			</AuthProvider>
		</BrowserRouter>
	)
}

export default App
