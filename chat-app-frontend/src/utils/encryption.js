import CryptoJS from 'crypto-js'

// ============================================================
// CZĘŚĆ 1: DIFFIE-HELLMAN (ECDH) - GENEROWANIE KLUCZY
// ============================================================

/**
 * Generuj parę kluczy ECDH (P-256)
 * @returns {Promise<{privateKey: CryptoKey, publicKeyJwk: Object}>}
 */
export const generateECDHKeyPair = async () => {
	const keyPair = await window.crypto.subtle.generateKey(
		{
			name: 'ECDH',
			namedCurve: 'P-256', // 🟡 Common paint (wspólne parametry)
		},
		true, // Exportable
		['deriveKey', 'deriveBits']
	)

	// Eksportuj klucz publiczny do JWK (JSON)
	const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey)

	console.log('🔑 Wygenerowano parę kluczy ECDH')

	return {
		privateKey: keyPair.privateKey, // CryptoKey (nie można bezpośrednio zapisać)
		publicKeyJwk: publicKeyJwk, // { kty: "EC", crv: "P-256", x: "...", y: "..." }
	}
}

// ============================================================
// CZĘŚĆ 2: BACKUP KLUCZA PRYWATNEGO (ZASZYFROWANY HASŁEM)
// ============================================================

/**
 * Zaszyfruj klucz prywatny hasłem użytkownika (do backupu na serwerze)
 * @param {string} privateKeyString - Klucz prywatny w formacie JSON
 * @param {string} password - Hasło użytkownika
 * @returns {string} - Zaszyfrowany klucz
 */
export const encryptPrivateKeyDH = (privateKeyString, password) => {
	return CryptoJS.AES.encrypt(privateKeyString, password).toString()
}

/**
 * Odszyfruj klucz prywatny hasłem użytkownika
 * @param {string} encryptedPrivateKey - Zaszyfrowany klucz
 * @param {string} password - Hasło użytkownika
 * @returns {string|null} - Odszyfrowany klucz lub null
 */
export const decryptPrivateKeyDH = (encryptedPrivateKey, password) => {
	try {
		const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, password)
		const decrypted = bytes.toString(CryptoJS.enc.Utf8)
		return decrypted || null
	} catch (error) {
		console.error('❌ Błąd deszyfrowania klucza prywatnego:', error)
		return null
	}
}

// ============================================================
// CZĘŚĆ 3: IMPORT/EXPORT KLUCZY
// ============================================================

/**
 * Importuj klucz prywatny z JWK do CryptoKey
 */
export const importPrivateKeyDH = async privateKeyJwk => {
	return await window.crypto.subtle.importKey(
		'jwk',
		privateKeyJwk,
		{
			name: 'ECDH',
			namedCurve: 'P-256',
		},
		true,
		['deriveKey', 'deriveBits']
	)
}

/**
 * Importuj klucz publiczny z JWK do CryptoKey
 */
export const importPublicKeyDH = async publicKeyJwk => {
	return await window.crypto.subtle.importKey(
		'jwk',
		publicKeyJwk,
		{
			name: 'ECDH',
			namedCurve: 'P-256',
		},
		true,
		[]
	)
}

// ============================================================
// CZĘŚĆ 4: 🟤 WYLICZANIE SHARED SECRET (KLUCZ AES)
// ============================================================

/**
 * Wylicz wspólny klucz AES używając ECDH
 * @param {CryptoKey} myPrivateKey - Mój klucz prywatny
 * @param {Object} otherUserPublicKeyJwk - Klucz publiczny drugiego użytkownika (JWK)
 * @returns {Promise<CryptoKey>} - Wspólny klucz AES-256
 */
export const deriveSharedSecretAES = async (myPrivateKey, otherUserPublicKeyJwk) => {
	// Importuj klucz publiczny drugiego użytkownika
	const otherPublicKey = await importPublicKeyDH(otherUserPublicKeyJwk)

	console.log('🔄 Wyliczam shared secret (ECDH)...')

	// 🟤 MAGICZNE MIESZANIE (ECDH)
	const sharedSecret = await window.crypto.subtle.deriveKey(
		{
			name: 'ECDH',
			public: otherPublicKey, // Klucz publiczny Bob'a
		},
		myPrivateKey, // Mój klucz prywatny (Alice)
		{
			name: 'AES-GCM',
			length: 256, // 256-bit AES
		},
		true, // Exportable (opcjonalnie, do cache)
		['encrypt', 'decrypt']
	)

	console.log('✅ Shared secret (klucz AES) wyliczony!')

	return sharedSecret // CryptoKey (AES-256)
}

// ============================================================
// CZĘŚĆ 5: SZYFROWANIE/DESZYFROWANIE WIADOMOŚCI (AES-GCM)
// ============================================================

/**
 * Zaszyfruj wiadomość kluczem AES
 * @param {string} message - Wiadomość plaintext
 * @param {CryptoKey} aesKey - Klucz AES (shared secret)
 * @returns {Promise<{ciphertext: string, iv: string}>}
 */
export const encryptMessageWithSharedSecret = async (message, aesKey) => {
	const encoder = new TextEncoder()
	const data = encoder.encode(message)

	// Losowy IV (Initialization Vector) - 12 bajtów
	const iv = window.crypto.getRandomValues(new Uint8Array(12))

	const ciphertext = await window.crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: iv,
		},
		aesKey,
		data
	)

	// Zwróć jako base64
	return {
		ciphertext: arrayBufferToBase64(ciphertext),
		iv: arrayBufferToBase64(iv),
	}
}

/**
 * Odszyfruj wiadomość kluczem AES
 * @param {Object} encryptedData - { ciphertext, iv }
 * @param {CryptoKey} aesKey - Klucz AES (shared secret)
 * @returns {Promise<string>} - Odszyfrowana wiadomość
 */
export const decryptMessageWithSharedSecret = async (encryptedData, aesKey) => {
	const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext)
	const iv = base64ToArrayBuffer(encryptedData.iv)

	const decrypted = await window.crypto.subtle.decrypt(
		{
			name: 'AES-GCM',
			iv: iv,
		},
		aesKey,
		ciphertext
	)

	const decoder = new TextDecoder()
	return decoder.decode(decrypted)
}

// ============================================================
// CZĘŚĆ 6: CACHE SHARED SECRET (LOCALSTORAGE)
// ============================================================

/**
 * Zapisz shared secret w localStorage (jako raw key exportowany)
 */
export const cacheSharedSecret = async (conversationId, sharedSecretKey) => {
	// Eksportuj klucz AES do raw
	const rawKey = await window.crypto.subtle.exportKey('raw', sharedSecretKey)
	const base64Key = arrayBufferToBase64(rawKey)

	const cache = JSON.parse(localStorage.getItem('sharedSecrets') || '{}')
	cache[conversationId] = base64Key
	localStorage.setItem('sharedSecrets', JSON.stringify(cache))

	console.log(`💾 Shared secret dla konwersacji ${conversationId} zapisany lokalnie`)
}

/**
 * Pobierz shared secret z localStorage
 */
export const getCachedSharedSecret = async conversationId => {
	const cache = JSON.parse(localStorage.getItem('sharedSecrets') || '{}')
	const base64Key = cache[conversationId]

	if (!base64Key) return null

	const rawKey = base64ToArrayBuffer(base64Key)

	// Importuj z powrotem do CryptoKey
	const sharedSecret = await window.crypto.subtle.importKey(
		'raw',
		rawKey,
		{
			name: 'AES-GCM',
			length: 256,
		},
		true,
		['encrypt', 'decrypt']
	)

	console.log(`📥 Shared secret dla konwersacji ${conversationId} pobrany z cache`)

	return sharedSecret
}

// ============================================================
// HELPERS: BASE64 CONVERSION
// ============================================================

function arrayBufferToBase64(buffer) {
	const bytes = new Uint8Array(buffer)
	let binary = ''
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return window.btoa(binary)
}

function base64ToArrayBuffer(base64) {
	const binary = window.atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes.buffer
}

// ============================================================
// CZĘŚĆ 7: STORAGE KLUCZY PRYWATNYCH (LOCALSTORAGE)
// ============================================================

/**
 * Zapisz klucz prywatny lokalnie (niezaszyfrowany, do użytku)
 */
export const savePrivateKeyDHLocally = privateKeyJwk => {
	localStorage.setItem('privateKeyDH', JSON.stringify(privateKeyJwk))
	console.log('💾 Klucz prywatny DH zapisany lokalnie')
}

/**
 * Pobierz klucz prywatny z localStorage
 */
export const getPrivateKeyDHLocally = () => {
	const privateKeyJwk = localStorage.getItem('privateKeyDH')
	return privateKeyJwk ? JSON.parse(privateKeyJwk) : null
}

/**
 * Sprawdź czy istnieje klucz prywatny lokalnie
 */
export const hasPrivateKeyDH = () => {
	return !!localStorage.getItem('privateKeyDH')
}
