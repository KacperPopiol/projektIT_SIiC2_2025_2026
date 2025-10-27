import CryptoJS from 'crypto-js'
import { ec as EC } from 'elliptic'

// Curve25519-like (używamy secp256k1 jako alternatywa dostępna w elliptic)
const ec = new EC('secp256k1')

/**
 * Generuj parę kluczy ECDH
 */
export const generateKeyPair = () => {
	const keyPair = ec.genKeyPair()
	const privateKey = keyPair.getPrivate('hex')
	const publicKey = keyPair.getPublic('hex')

	return { privateKey, publicKey }
}

/**
 * Generuj Pre-Keys (jednorazowe klucze)
 */
export const generatePreKeys = (count = 10) => {
	const preKeys = []
	for (let i = 0; i < count; i++) {
		const keyPair = ec.genKeyPair()
		preKeys.push({
			id: i + 1,
			publicKey: keyPair.getPublic('hex'),
			privateKey: keyPair.getPrivate('hex'),
		})
	}
	return preKeys
}

/**
 * Oblicz współdzielony sekret ECDH
 */
export const computeSharedSecret = (myPrivateKey, theirPublicKey) => {
	const myKey = ec.keyFromPrivate(myPrivateKey, 'hex')
	const theirKey = ec.keyFromPublic(theirPublicKey, 'hex')
	const shared = myKey.derive(theirKey.getPublic())
	return shared.toString(16)
}

/**
 * Zaszyfruj wiadomość kluczem AES-256
 */
export const encryptMessage = (message, key) => {
	return CryptoJS.AES.encrypt(message, key).toString()
}

/**
 * Odszyfruj wiadomość kluczem AES-256
 */
export const decryptMessage = (encryptedMessage, key) => {
	try {
		const bytes = CryptoJS.AES.decrypt(encryptedMessage, key)
		return bytes.toString(CryptoJS.enc.Utf8)
	} catch (error) {
		console.error('Błąd deszyfrowania:', error)
		return null
	}
}

/**
 * Zapisz klucz prywatny w localStorage (zaszyfrowany hasłem)
 */
export const savePrivateKey = (privateKey, password) => {
	const encrypted = CryptoJS.AES.encrypt(privateKey, password).toString()
	localStorage.setItem('encryptedPrivateKey', encrypted)
}

/**
 * Odczytaj klucz prywatny z localStorage
 */
export const getPrivateKey = password => {
	const encrypted = localStorage.getItem('encryptedPrivateKey')
	if (!encrypted) return null

	try {
		const decrypted = CryptoJS.AES.decrypt(encrypted, password).toString(CryptoJS.enc.Utf8)
		return decrypted
	} catch (error) {
		console.error('Błąd deszyfrowania klucza prywatnego:', error)
		return null
	}
}

/**
 * Zapisz Pre-Keys w localStorage
 */
export const savePreKeys = preKeys => {
	localStorage.setItem('preKeys', JSON.stringify(preKeys))
}

/**
 * Pobierz Pre-Keys z localStorage
 */
export const getPreKeys = () => {
	const stored = localStorage.getItem('preKeys')
	return stored ? JSON.parse(stored) : []
}

/**
 * Zapisz klucz sesji dla konwersacji
 */
export const saveSessionKey = (conversationId, sessionKey) => {
	const sessions = JSON.parse(localStorage.getItem('sessionKeys') || '{}')
	sessions[conversationId] = sessionKey
	localStorage.setItem('sessionKeys', JSON.stringify(sessions))
}

/**
 * Pobierz klucz sesji dla konwersacji
 */
export const getSessionKey = conversationId => {
	const sessions = JSON.parse(localStorage.getItem('sessionKeys') || '{}')
	return sessions[conversationId] || null
}

/**
 * Usuń klucz sesji (przy usunięciu znajomego)
 */
export const removeSessionKey = conversationId => {
	const sessions = JSON.parse(localStorage.getItem('sessionKeys') || '{}')
	delete sessions[conversationId]
	localStorage.setItem('sessionKeys', JSON.stringify(sessions))
}

/**
 * Oblicz SHA-256 hash (fingerprint)
 */
export const calculateFingerprint = data => {
	return CryptoJS.SHA256(data).toString()
}
