import { useState, useEffect } from 'react'
import { filesApi } from '../../api/filesApi'

const MAX_PREVIEW_WIDTH = 240
const MAX_PREVIEW_HEIGHT = 240

const FilePreview = ({ file, messageSenderId, currentUserId }) => {
	const [imageError, setImageError] = useState(false)
	const [showFullImage, setShowFullImage] = useState(false)
	const [fileUrl, setFileUrl] = useState(null)
	const [thumbnailUrl, setThumbnailUrl] = useState(null)
	const [loading, setLoading] = useState(true)

	// Pobierz URL pliku i miniatury
	useEffect(() => {
		let currentFileUrl = null
		let currentThumbnailUrl = null
		let isMounted = true

		const loadUrls = async () => {
			try {
				setLoading(true)
				const url = await filesApi.getFileUrl(file.file_id)
				
				if (!isMounted) return
				
				currentFileUrl = url
				setFileUrl(url)

				if (file.mime_category === 'image' && file.thumbnail_path) {
					try {
						const thumbUrl = await filesApi.getFileThumbnailUrl(file.file_id)
						
						if (!isMounted) return
						
						currentThumbnailUrl = thumbUrl
						setThumbnailUrl(thumbUrl)
					} catch (error) {
						console.warn('Nie udało się pobrać miniatury, używam pełnego obrazu')
						if (isMounted) {
							currentThumbnailUrl = url
							setThumbnailUrl(url)
						}
					}
				} else {
					if (isMounted) {
						currentThumbnailUrl = url
						setThumbnailUrl(url)
					}
				}
			} catch (error) {
				console.error('Błąd pobierania pliku:', error)
				if (isMounted) {
					setLoading(false)
				}
			} finally {
				if (isMounted) {
					setLoading(false)
				}
			}
		}

		loadUrls()

		// Cleanup: revoke blob URLs
		return () => {
			isMounted = false
			if (currentFileUrl) URL.revokeObjectURL(currentFileUrl)
			if (currentThumbnailUrl && currentThumbnailUrl !== currentFileUrl) {
				URL.revokeObjectURL(currentThumbnailUrl)
			}
		}
	}, [file.file_id, file.mime_category, file.thumbnail_path])

	const isOwnMessage = messageSenderId === currentUserId

	const getFileIcon = () => {
		if (file.mime_category === 'image') return '🖼️'
		if (file.mime_category === 'pdf') return '📄'
		if (file.mime_category === 'video') return '🎥'
		if (file.mime_category === 'audio') return '🎵'
		if (file.mime_category === 'document') return '📎'
		return '📎'
	}

	const renderImage = () => {
		if (loading || !fileUrl) {
			return (
				<div
					style={{
						width: '300px',
						height: '150px',
						borderRadius: '8px',
						backgroundColor: '#f0f0f0',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						border: '1px solid #ddd',
					}}>
					<div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>
						<div style={{ marginBottom: '5px' }}>⏳</div>
						<div>Ładowanie...</div>
					</div>
				</div>
			)
		}

		const displayUrl = thumbnailUrl || fileUrl

		const previewBox = (
			<div
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					borderRadius: '8px',
					overflow: 'hidden',
					border: '1px solid #ddd',
					backgroundColor: '#f0f0f0',
					maxWidth: `${MAX_PREVIEW_WIDTH}px`,
					maxHeight: `${MAX_PREVIEW_HEIGHT}px`,
					cursor: 'pointer',
				}}
				onClick={() => setShowFullImage(true)}>
				<img
					src={displayUrl}
					alt={file.original_name}
					onError={() => setImageError(true)}
					onLoad={() => setImageError(false)}
					style={{
						display: 'block',
						maxWidth: `${MAX_PREVIEW_WIDTH}px`,
						maxHeight: `${MAX_PREVIEW_HEIGHT}px`,
						width: 'auto',
						height: 'auto',
						objectFit: 'contain',
					}}
				/>
			</div>
		)

		return (
			<div style={{ position: 'relative', display: 'inline-flex' }}>
				{showFullImage ? (
					<div
						style={{
							position: 'fixed',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundColor: 'rgba(0,0,0,0.9)',
							zIndex: 9999,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							cursor: 'pointer',
						}}
						onClick={() => setShowFullImage(false)}>
						<img
							src={fileUrl}
							alt={file.original_name}
							style={{
								maxWidth: '90%',
								maxHeight: '90%',
								objectFit: 'contain',
							}}
						/>
					</div>
				) : (
					previewBox
				)}
			</div>
		)
	}

	const renderVideo = () => {
		if (loading || !fileUrl) {
			return (
				<div
					style={{
						width: '150px',
						height: '150px',
						borderRadius: '8px',
						backgroundColor: '#f0f0f0',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						border: '1px solid #ddd',
					}}>
					<div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>
						<div style={{ marginBottom: '5px' }}>⏳</div>
						<div>Ładowanie...</div>
					</div>
				</div>
			)
		}
		return (
			<div
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					borderRadius: '8px',
					overflow: 'hidden',
					border: '1px solid #ddd',
					backgroundColor: '#000',
					maxWidth: `${MAX_PREVIEW_WIDTH}px`,
					maxHeight: `${MAX_PREVIEW_HEIGHT}px`,
				}}>
				<video
					controls
					style={{
						display: 'block',
						maxWidth: `${MAX_PREVIEW_WIDTH}px`,
						maxHeight: `${MAX_PREVIEW_HEIGHT}px`,
						width: 'auto',
						height: 'auto',
					}}>
					<source src={fileUrl} type={file.file_type} />
					Twoja przeglądarka nie obsługuje odtwarzania wideo.
				</video>
			</div>
		)
	}

	const renderAudio = () => {
		if (loading || !fileUrl) {
			return (
				<div
					style={{
						width: '150px',
						height: '150px',
						borderRadius: '8px',
						backgroundColor: '#f0f0f0',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						border: '1px solid #ddd',
						flexDirection: 'column',
					}}>
					<div style={{ fontSize: '32px', marginBottom: '5px' }}>🎵</div>
					<div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>
						<div>⏳</div>
						<div>Ładowanie...</div>
					</div>
				</div>
			)
		}
		return (
			<div
				style={{
					width: '150px',
					padding: '10px',
					borderRadius: '8px',
					border: '1px solid #ddd',
					backgroundColor: '#f8f9fa',
				}}>
				<div style={{ fontSize: '24px', marginBottom: '8px', textAlign: 'center' }}>🎵</div>
				<div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textAlign: 'center', wordBreak: 'break-word' }}>
					{file.original_name}
				</div>
				<audio controls style={{ width: '100%', height: '32px' }}>
					<source src={fileUrl} type={file.file_type} />
					Twoja przeglądarka nie obsługuje odtwarzania audio.
				</audio>
			</div>
		)
	}

	const renderPDF = () => {
		if (loading || !fileUrl) {
			return (
				<div
					style={{
						width: '150px',
						height: '150px',
						borderRadius: '8px',
						backgroundColor: '#f0f0f0',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						border: '1px solid #ddd',
						flexDirection: 'column',
					}}>
					<div style={{ fontSize: '32px', marginBottom: '5px' }}>📄</div>
					<div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>
						<div>⏳</div>
						<div>Ładowanie...</div>
					</div>
				</div>
			)
		}
		return (
			<div
				style={{
					width: '150px',
					height: '150px',
					border: '1px solid #ddd',
					borderRadius: '8px',
					overflow: 'hidden',
					backgroundColor: '#fff',
					cursor: 'pointer',
				}}
				onClick={() => window.open(fileUrl, '_blank')}>
				<div
					style={{
						width: '100%',
						height: '100%',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						padding: '10px',
						textAlign: 'center',
					}}>
					<div style={{ fontSize: '48px', marginBottom: '5px' }}>📄</div>
					<div style={{ fontSize: '10px', color: '#666', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{file.original_name}
					</div>
					<div style={{ fontSize: '9px', color: '#999', marginTop: '3px' }}>Kliknij aby otworzyć</div>
				</div>
			</div>
		)
	}

	const renderDocument = () => {
		if (loading || !fileUrl) {
			return (
				<div
					style={{
						width: '150px',
						height: '150px',
						borderRadius: '8px',
						backgroundColor: '#f0f0f0',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						border: '1px solid #ddd',
						flexDirection: 'column',
					}}>
					<div style={{ fontSize: '32px', marginBottom: '5px' }}>{getFileIcon()}</div>
					<div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>
						<div>⏳</div>
						<div>Ładowanie...</div>
					</div>
				</div>
			)
		}

		const downloadFile = async () => {
			try {
				const url = await filesApi.getFileUrl(file.file_id)
				const a = document.createElement('a')
				a.href = url
				a.download = file.original_name
				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)
			} catch (error) {
				console.error('Błąd pobierania pliku:', error)
				alert('Nie udało się pobrać pliku')
			}
		}

		return (
			<div
				style={{
					width: '150px',
					height: '150px',
					border: '1px solid #ddd',
					borderRadius: '8px',
					overflow: 'hidden',
					backgroundColor: '#fff',
					cursor: 'pointer',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					padding: '10px',
					textAlign: 'center',
				}}
				onClick={downloadFile}
				title="Kliknij aby pobrać">
				<div style={{ fontSize: '48px', marginBottom: '8px' }}>{getFileIcon()}</div>
				<div
					style={{
						fontSize: '10px',
						color: '#666',
						wordBreak: 'break-word',
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						display: '-webkit-box',
						WebkitLineClamp: 2,
						WebkitBoxOrient: 'vertical',
						marginBottom: '5px',
					}}>
					{file.original_name}
				</div>
				<div style={{ fontSize: '9px', color: '#999' }}>{filesApi.formatFileSize(file.file_size)}</div>
				<div style={{ fontSize: '9px', color: '#007bff', marginTop: '5px' }}>Kliknij aby pobrać</div>
			</div>
		)
	}

	const renderContent = () => {
		switch (file.mime_category) {
			case 'image':
				return renderImage()
			case 'video':
				return renderVideo()
			case 'audio':
				return renderAudio()
			case 'pdf':
				return renderPDF()
			case 'document':
				return renderDocument()
			default:
				return renderDocument()
		}
	}

	return (
		<div
			style={{
				marginTop: '8px',
				marginBottom: '8px',
				display: 'flex',
				justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
			}}>
			<div
				style={{
					display: 'inline-flex',
					flexDirection: 'column',
					alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
					gap: '5px',
				}}>
				{renderContent()}
			</div>
		</div>
	)
}

export default FilePreview

