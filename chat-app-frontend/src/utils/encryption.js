import CryptoJS from 'crypto-js'

/**
 * @returns {Promise<{privateKey: CryptoKey, publicKeyJwk: Object}>}
 */
export const generateECDHKeyPair = async () => {
	const keyPair = await window.crypto.subtle.generateKey(
		{
			name: 'ECDH',
			namedCurve: 'P-256',
		},
		true, // Exportable
		['deriveKey', 'deriveBits']
	)

	const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey)

	console.log('🔑 Wygenerowano parę kluczy ECDH')

	return {
		privateKey: keyPair.privateKey,
		publicKeyJwk: publicKeyJwk,
	}
}

/**
 * @param {string} privateKeyString
 * @param {string} password
 * @returns {string}
 */
export const encryptPrivateKeyDH = (privateKeyString, password) => {
	return CryptoJS.AES.encrypt(privateKeyString, password).toString()
}

/**
 * @param {string} encryptedPrivateKey
 * @param {string} password
 * @returns {string|null}
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

/**
 * @param {CryptoKey} myPrivateKey
 * @param {Object} otherUserPublicKeyJwk
 * @returns {Promise<CryptoKey>}
 */
export const deriveSharedSecretAES = async (myPrivateKey, otherUserPublicKeyJwk) => {
	const otherPublicKey = await importPublicKeyDH(otherUserPublicKeyJwk)

	console.log('🔄 Wyliczam shared secret (ECDH)...')

	const sharedSecret = await window.crypto.subtle.deriveKey(
		{
			name: 'ECDH',
			public: otherPublicKey,
		},
		myPrivateKey,
		{
			name: 'AES-GCM',
			length: 256,
		},
		true,
		['encrypt', 'decrypt']
	)

	console.log('✅ Shared secret (klucz AES) wyliczony!')

	return sharedSecret
}

/**
 * @param {string} message
 * @param {CryptoKey} aesKey
 * @returns {Promise<{ciphertext: string, iv: string}>}
 */
export const encryptMessageWithSharedSecret = async (message, aesKey) => {
	const encoder = new TextEncoder()
	const data = encoder.encode(message)

	const iv = window.crypto.getRandomValues(new Uint8Array(12))

	const ciphertext = await window.crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: iv,
		},
		aesKey,
		data
	)

	return {
		ciphertext: arrayBufferToBase64(ciphertext),
		iv: arrayBufferToBase64(iv),
	}
}

/**
 * @param {Object} encryptedData
 * @param {CryptoKey} aesKey
 * @returns {Promise<string>}
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

export const cacheSharedSecret = async (conversationId, sharedSecretKey) => {
	const rawKey = await window.crypto.subtle.exportKey('raw', sharedSecretKey)
	const base64Key = arrayBufferToBase64(rawKey)

	const cache = JSON.parse(localStorage.getItem('sharedSecrets') || '{}')
	cache[conversationId] = base64Key
	localStorage.setItem('sharedSecrets', JSON.stringify(cache))
}

export const getCachedSharedSecret = async conversationId => {
	const cache = JSON.parse(localStorage.getItem('sharedSecrets') || '{}')
	const base64Key = cache[conversationId]

	if (!base64Key) return null

	const rawKey = base64ToArrayBuffer(base64Key)

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

export const savePrivateKeyDHLocally = privateKeyJwk => {
	localStorage.setItem('privateKeyDH', JSON.stringify(privateKeyJwk))
}

export const getPrivateKeyDHLocally = () => {
	const privateKeyJwk = localStorage.getItem('privateKeyDH')
	return privateKeyJwk ? JSON.parse(privateKeyJwk) : null
}

export const hasPrivateKeyDH = () => {
	return !!localStorage.getItem('privateKeyDH')
}
