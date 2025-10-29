import { deriveSharedSecretAES, encryptMessageWithSharedSecret, decryptMessageWithSharedSecret } from './encryption'

/**
 * Generuje losowy klucz AES dla grupy
 */
export const generateGroupKey = async () => {
	const key = await crypto.subtle.generateKey(
		{
			name: 'AES-GCM',
			length: 256,
		},
		true, // extractable
		['encrypt', 'decrypt']
	)
	return key
}

/**
 * Eksportuje klucz grupowy do JWK
 */
export const exportGroupKey = async groupKey => {
	return await crypto.subtle.exportKey('jwk', groupKey)
}

/**
 * Importuje klucz grupowy z JWK
 */
export const importGroupKey = async groupKeyJwk => {
	return await crypto.subtle.importKey('jwk', groupKeyJwk, { name: 'AES-GCM', length: 256 }, true, [
		'encrypt',
		'decrypt',
	])
}

/**
 * Szyfruje klucz grupowy dla konkretnego użytkownika
 * używając jego klucza publicznego DH
 */
export const encryptGroupKeyForUser = async (groupKeyJwk, userPublicKeyJwk, myPrivateKeyDH) => {
	// Derive shared secret z użytkownikiem
	const sharedSecret = await deriveSharedSecretAES(myPrivateKeyDH, userPublicKeyJwk)

	// Zaszyfruj groupKey tym shared secret
	const groupKeyString = JSON.stringify(groupKeyJwk)
	const encrypted = await encryptMessageWithSharedSecret(groupKeyString, sharedSecret)

	return encrypted // { ciphertext, iv }
}

/**
 * Odszyfrowuje klucz grupowy
 */
export const decryptGroupKey = async (
	encryptedGroupKey, // { ciphertext, iv }
	senderPublicKeyJwk,
	myPrivateKeyDH
) => {
	// Derive shared secret z nadawcą
	const sharedSecret = await deriveSharedSecretAES(myPrivateKeyDH, senderPublicKeyJwk)

	// Odszyfruj
	const groupKeyString = await decryptMessageWithSharedSecret(encryptedGroupKey, sharedSecret)

	// Parse i importuj
	const groupKeyJwk = JSON.parse(groupKeyString)
	return await importGroupKey(groupKeyJwk)
}

/**
 * Szyfruje wiadomość kluczem grupowym
 */
export const encryptGroupMessage = async (message, groupKey) => {
	const encoder = new TextEncoder()
	const data = encoder.encode(message)

	const iv = crypto.getRandomValues(new Uint8Array(12))

	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, groupKey, data)

	return {
		ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
		iv: btoa(String.fromCharCode(...iv)),
	}
}

/**
 * Odszyfrowuje wiadomość kluczem grupowym
 */
export const decryptGroupMessage = async (encryptedData, groupKey) => {
	// ✅ GUARD CLAUSE - sprawdź czy dane są poprawne
	if (!encryptedData) {
		console.error('❌ decryptGroupMessage: encryptedData is null or undefined')
		throw new Error('encryptedData is required')
	}

	if (typeof encryptedData !== 'object') {
		console.error('❌ decryptGroupMessage: encryptedData is not an object:', encryptedData)
		throw new Error('encryptedData must be an object')
	}

	if (!encryptedData.ciphertext) {
		console.error('❌ decryptGroupMessage: missing ciphertext')
		throw new Error('encryptedData.ciphertext is required')
	}

	if (!encryptedData.iv) {
		console.error('❌ decryptGroupMessage: missing iv')
		throw new Error('encryptedData.iv is required')
	}

	console.log('🔓 Deszyfrowanie z danymi:', {
		ciphertextLength: encryptedData.ciphertext.length,
		ivLength: encryptedData.iv.length,
	})

	try {
		const ciphertext = Uint8Array.from(atob(encryptedData.ciphertext), c => c.charCodeAt(0))
		const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0))

		const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, groupKey, ciphertext)

		const decoder = new TextDecoder()
		const result = decoder.decode(plaintext)

		console.log('✅ Odszyfrowano:', result)
		return result
	} catch (error) {
		console.error('❌ Błąd podczas deszyfrowania:', error)
		throw error
	}
}

// Cache dla kluczy grupowych
const groupKeysCache = new Map()

export const cacheGroupKey = (groupId, groupKey) => {
	groupKeysCache.set(groupId, groupKey)
}

export const getCachedGroupKey = groupId => {
	return groupKeysCache.get(groupId)
}
