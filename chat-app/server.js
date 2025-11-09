const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
require('dotenv').config()

const db = require('./src/models')
const socketHandler = require('./src/socket/socketHandler')
const disappearingMessagesScheduler = require('./src/utils/disappearingMessagesScheduler')

// Import tras
const authRoutes = require('./src/routes/auth')
const userRoutes = require('./src/routes/users')
const contactRoutes = require('./src/routes/contacts')
const groupRoutes = require('./src/routes/groups')
const messageRoutes = require('./src/routes/messages')
const keysRoutes = require('./src/routes/keysRoutes')
const fileRoutes = require('./src/routes/files')

// Inicjalizacja Express
const app = express()
const server = http.createServer(app)

// Konfiguracja Socket.io z CORS
const io = new Server(server, {
	cors: {
		origin: '*', // W produkcji zmień na konkretny URL frontendu
		methods: ['GET', 'POST', 'PUT', 'DELETE'],
		credentials: true,
	},
})

// ==================== MIDDLEWARE ====================

// CORS - pozwól na zapytania z innych domen
app.use(
	cors({
		origin: '*', // W produkcji zmień na konkretny URL
		credentials: true,
	})
)

// Parsowanie JSON i URL-encoded data
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Logowanie requestów (development)
if (process.env.NODE_ENV === 'development') {
	app.use((req, res, next) => {
		console.log(`📨 ${req.method} ${req.path}`)
		next()
	})
}

// ==================== TRASY API ====================

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/contacts', contactRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/keys', keysRoutes)
app.use('/api/files', fileRoutes)

// ==================== HEALTH CHECK ====================

app.get('/', (req, res) => {
	res.json({
		success: true,
		message: 'Chat App API Server',
		version: '1.0.0',
		status: 'running',
	})
})

app.get('/health', (req, res) => {
	res.json({
		success: true,
		status: 'OK',
		message: 'Server is running',
		timestamp: new Date().toISOString(),
	})
})

// ==================== OBSŁUGA BŁĘDÓW 404 ====================

app.use((req, res) => {
	res.status(404).json({
		success: false,
		error: 'Endpoint not found',
		path: req.path,
	})
})

// ==================== OBSŁUGA BŁĘDÓW GLOBALNYCH ====================

app.use((err, req, res, next) => {
	console.error('❌ Server Error:', err)
	res.status(500).json({
		success: false,
		error: 'Internal server error',
		message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
	})
})

// ==================== SOCKET.IO ====================

socketHandler(io)

// Dodaj io do app locals aby kontrolery miały dostęp
app.set('io', io)

// ==================== URUCHOMIENIE SERWERA ====================

const PORT = process.env.PORT || 3000

// Synchronizuj bazę danych i uruchom serwer
const startServer = async () => {
	try {
		// Synchronizuj modele z bazą danych
		// force: false - nie usuwa istniejących tabel
		// alter: false - nie aktualizuje struktury tabel (zmienione na false aby uniknąć problemu z limitem indeksów MySQL)
		await db.sequelize.sync({ force: false, alter: false })
		console.log('✅ Database synchronized successfully')

		// Uruchom scheduler znikających wiadomości (przekaż io instance)
		disappearingMessagesScheduler.start(io)

		// Uruchom serwer HTTP
		server.listen(PORT, () => {
			console.log('\n' + '='.repeat(50))
			console.log('🚀 SERVER STARTED SUCCESSFULLY')
			console.log('='.repeat(50))
			console.log(`📡 Server running on: http://localhost:${PORT}`)
			console.log(`🗄️  Database: ${process.env.DB_NAME}`)
			console.log(`🔌 Socket.io: Ready for connections`)
			console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
			console.log('='.repeat(50) + '\n')
			console.log('📍 Available endpoints:')
			console.log('   - GET  / (Home)')
			console.log('   - GET  /health (Health check)')
			console.log('   - POST /api/auth/register')
			console.log('   - POST /api/auth/login')
			console.log('   - POST /api/auth/recover')
			console.log('   - GET  /api/auth/profile')
			console.log('   - POST /api/contacts/generate-code')
			console.log('   - POST /api/contacts/invite')
			console.log('   - GET  /api/contacts')
			console.log('   - POST /api/groups')
			console.log('   - GET  /api/groups/my-groups')
			console.log('   - GET  /api/messages/conversations')
			console.log('   ...and more!\n')
		})
	} catch (error) {
		console.error('❌ Unable to start server:', error)
		process.exit(1)
	}
}

// Obsługa zamykania serwera
process.on('SIGINT', async () => {
	console.log('\n\n🛑 Shutting down server...')
	disappearingMessagesScheduler.stop()
	await db.sequelize.close()
	console.log('✅ Database connection closed')
	process.exit(0)
})

process.on('SIGTERM', async () => {
	console.log('\n\n🛑 Shutting down server...')
	disappearingMessagesScheduler.stop()
	await db.sequelize.close()
	console.log('✅ Database connection closed')
	process.exit(0)
})

// Uruchom serwer
startServer()

module.exports = { app, io, server }
