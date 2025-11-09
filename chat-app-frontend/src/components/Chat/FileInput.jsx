import { useState, useRef } from 'react'
import { filesApi } from '../../api/filesApi'

const MAX_FILES = 5
const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200 MB

const ALLOWED_TYPES = {
	// Obrazy
	'image/jpeg': true,
	'image/jpg': true,
	'image/png': true,
	'image/gif': true,
	'image/webp': true,
	// PDF
	'application/pdf': true,
	// Dokumenty
	'application/msword': true, // .doc
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true, // .docx
	'application/vnd.ms-excel': true, // .xls
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true, // .xlsx
	'application/vnd.ms-powerpoint': true, // .ppt
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': true, // .pptx
	// Wideo
	'video/mp4': true,
	'video/webm': true,
	'video/x-msvideo': true, // .avi
	// Audio
	'audio/mpeg': true, // .mp3
	'audio/wav': true,
	'audio/ogg': true,
}

const FileInput = ({ onFilesSelected, selectedFiles = [], onRemoveFile }) => {
	const [dragActive, setDragActive] = useState(false)
	const fileInputRef = useRef(null)

	const validateFile = file => {
		// Sprawdź typ
		if (!ALLOWED_TYPES[file.type]) {
			return {
				valid: false,
				error: `Nieobsługiwany typ pliku: ${file.name}. Dozwolone: obrazy, PDF, dokumenty, wideo, audio.`,
			}
		}

		// Sprawdź rozmiar
		if (file.size > MAX_FILE_SIZE) {
			return {
				valid: false,
				error: `Plik ${file.name} jest za duży (max ${filesApi.formatFileSize(MAX_FILE_SIZE)})`,
			}
		}

		return { valid: true }
	}

	const handleFileSelect = files => {
		const fileArray = Array.from(files)
		const newFiles = []
		const errors = []

		// Sprawdź limit liczby plików
		const totalFiles = selectedFiles.length + fileArray.length
		if (totalFiles > MAX_FILES) {
			errors.push(`Maksymalnie ${MAX_FILES} plików jednocześnie`)
			alert(`Maksymalnie ${MAX_FILES} plików jednocześnie`)
			return
		}

		// Waliduj każdy plik
		for (const file of fileArray) {
			const validation = validateFile(file)
			if (validation.valid) {
				newFiles.push(file)
			} else {
				errors.push(validation.error)
			}
		}

		// Pokaż błędy jeśli są
		if (errors.length > 0) {
			alert(errors.join('\n'))
		}

		// Dodaj poprawne pliki
		if (newFiles.length > 0) {
			onFilesSelected([...selectedFiles, ...newFiles])
		}
	}

	const handleInputChange = e => {
		if (e.target.files && e.target.files.length > 0) {
			handleFileSelect(e.target.files)
		}
		// Reset input
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}

	const handleDrag = e => {
		e.preventDefault()
		e.stopPropagation()
		if (e.type === 'dragenter' || e.type === 'dragover') {
			setDragActive(true)
		} else if (e.type === 'dragleave') {
			setDragActive(false)
		}
	}

	const handleDrop = e => {
		e.preventDefault()
		e.stopPropagation()
		setDragActive(false)

		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			handleFileSelect(e.dataTransfer.files)
		}
	}

	const getFileIcon = file => {
		if (file.type.startsWith('image/')) return '🖼️'
		if (file.type === 'application/pdf') return '📄'
		if (file.type.startsWith('video/')) return '🎥'
		if (file.type.startsWith('audio/')) return '🎵'
		if (
			file.type.includes('word') ||
			file.type.includes('excel') ||
			file.type.includes('powerpoint') ||
			file.type.includes('msword') ||
			file.type.includes('spreadsheet') ||
			file.type.includes('presentation')
		) {
			return '📎'
		}
		return '📎'
	}

	return (
		<div
			onDragEnter={handleDrag}
			onDragLeave={handleDrag}
			onDragOver={handleDrag}
			onDrop={handleDrop}
			style={{ position: 'relative' }}>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,video/*,audio/*"
				onChange={handleInputChange}
				style={{ display: 'none' }}
			/>

			{/* Mały przycisk do wyboru plików */}
			<button
				type="button"
				onClick={() => fileInputRef.current?.click()}
				style={{
					padding: '8px 12px',
					backgroundColor: dragActive ? '#0056b3' : '#007bff',
					color: 'white',
					border: 'none',
					borderRadius: '6px',
					cursor: 'pointer',
					fontSize: '13px',
					display: 'inline-flex',
					alignItems: 'center',
					gap: '6px',
					transition: 'background-color 0.2s',
					whiteSpace: 'nowrap',
				}}
				title={`Dodaj pliki (max ${MAX_FILES}, ${filesApi.formatFileSize(MAX_FILE_SIZE)} każdy)`}>
				<span>📎</span>
				<span>Dodaj pliki</span>
			</button>
		</div>
	)
}

export default FileInput

