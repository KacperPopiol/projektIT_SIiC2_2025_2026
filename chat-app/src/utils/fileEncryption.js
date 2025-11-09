/**
 * Utility functions dla szyfrowania plików
 * 
 * UWAGA: Szyfrowanie plików odbywa się po stronie FRONTENDU przed uploadem.
 * Backend przechowuje już zaszyfrowane pliki.
 * 
 * Te funkcje są przeznaczone głównie do dokumentacji i ewentualnych
 * przyszłych funkcji serwerowych (np. automatyczne szyfrowanie dla backupów).
 */

const crypto = require('crypto')

/**
 * Generuje IV (Initialization Vector) dla szyfrowania AES-GCM
 * @returns {Buffer} - 12-bajtowy IV
 */
const generateFileIV = () => {
	return crypto.randomBytes(12)
}

/**
 * Szyfruje dane pliku używając AES-256-GCM
 * UWAGA: Ta funkcja jest przykładowa - rzeczywiste szyfrowanie odbywa się po stronie frontendu
 * 
 * @param {Buffer} fileData - Dane pliku do zaszyfrowania
 * @param {Buffer} key - 32-bajtowy klucz AES (256 bit)
 * @param {Buffer} iv - 12-bajtowy IV (opcjonalny, jeśli nie podany - wygenerowany)
 * @returns {{encrypted: Buffer, iv: Buffer, authTag: Buffer}} - Zaszyfrowane dane, IV i auth tag
 */
const encryptFileBuffer = (fileData, key, iv = null) => {
	if (!iv) {
		iv = generateFileIV()
	}

	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
	const encrypted = Buffer.concat([cipher.update(fileData), cipher.final()])
	const authTag = cipher.getAuthTag()

	return {
		encrypted,
		iv,
		authTag,
	}
}

/**
 * Deszyfruje dane pliku używając AES-256-GCM
 * UWAGA: Ta funkcja jest przykładowa - rzeczywiste deszyfrowanie odbywa się po stronie frontendu
 * 
 * @param {Buffer} encryptedData - Zaszyfrowane dane
 * @param {Buffer} key - 32-bajtowy klucz AES (256 bit)
 * @param {Buffer} iv - 12-bajtowy IV
 * @param {Buffer} authTag - Auth tag z szyfrowania
 * @returns {Buffer} - Odszyfrowane dane
 */
const decryptFileBuffer = (encryptedData, key, iv, authTag) => {
	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
	decipher.setAuthTag(authTag)

	const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])

	return decrypted
}

module.exports = {
	generateFileIV,
	encryptFileBuffer,
	decryptFileBuffer,
}

