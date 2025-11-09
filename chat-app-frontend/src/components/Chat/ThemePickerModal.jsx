import { useMemo } from 'react'

const backdropStyle = {
	position: 'fixed',
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	backgroundColor: 'rgba(0,0,0,0.55)',
	zIndex: 2000,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	padding: '30px',
}

const modalStyle = {
	backgroundColor: '#ffffff',
	borderRadius: '14px',
	width: '100%',
	maxWidth: '620px',
	maxHeight: '85vh',
	display: 'flex',
	flexDirection: 'column',
	boxShadow: '0 18px 45px rgba(0,0,0,0.2)',
	overflow: 'hidden',
}

const headerStyle = {
	padding: '20px 24px',
	borderBottom: '1px solid #f0f0f0',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
}

const gridStyle = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
	gap: '16px',
	padding: '24px',
	overflowY: 'auto',
}

const ThemePickerModal = ({
	isOpen,
	onClose,
	themes = [],
	onSelect,
	selectedThemeKey,
	isSaving = false,
}) => {
	const sortedThemes = useMemo(() => {
		return [...themes].sort((a, b) => a.name.localeCompare(b.name, 'pl'))
	}, [themes])

	if (!isOpen) {
		return null
	}

	return (
		<div style={backdropStyle} onClick={onClose}>
			<div style={modalStyle} onClick={e => e.stopPropagation()}>
				<div style={headerStyle}>
					<div>
						<h2 style={{ margin: 0 }}>Wybierz motyw rozmowy</h2>
						<p style={{ margin: '6px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
							Motyw zostanie ustawiony dla wszystkich uczestników konwersacji.
						</p>
					</div>
					<button
						onClick={onClose}
						style={{
							background: 'none',
							border: 'none',
							fontSize: '20px',
							cursor: 'pointer',
							color: '#6c757d',
						}}
						disabled={isSaving}>
						×
					</button>
				</div>

				<div style={gridStyle}>
					{sortedThemes.map(theme => {
						const isActive = theme.key === selectedThemeKey
						return (
							<button
								key={theme.key}
								onClick={() => onSelect(theme)}
								disabled={isSaving}
								style={{
									border: isActive ? '2px solid #007bff' : '1px solid #e5e7eb',
									borderRadius: '12px',
									padding: '16px',
									backgroundColor: '#ffffff',
									cursor: isSaving ? 'not-allowed' : 'pointer',
									textAlign: 'left',
									boxShadow: isActive ? '0 10px 24px rgba(0,123,255,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
									transition: 'transform 0.2s, box-shadow 0.2s',
								}}
								onMouseEnter={e => {
									if (!isSaving) {
										e.currentTarget.style.transform = 'translateY(-4px)'
									}
								}}
								onMouseLeave={e => {
									e.currentTarget.style.transform = 'translateY(0)'
								}}>
								<div
									style={{
										borderRadius: '10px',
										height: '90px',
										marginBottom: '12px',
										background: theme.preview,
										position: 'relative',
										overflow: 'hidden',
									}}>
									<div
										style={{
											position: 'absolute',
											top: 0,
											left: 0,
											right: 0,
											bottom: 0,
											background: theme.variables.backgroundImage || 'none',
											opacity: theme.variables.backgroundImage ? 1 : 0,
											transition: 'opacity 0.2s',
										}}
									/>
									<div
										style={{
											position: 'absolute',
											bottom: '12px',
											left: '12px',
											right: '12px',
											display: 'flex',
											justifyContent: 'space-between',
											gap: '8px',
										}}>
										<span
											style={{
												flex: 1,
												padding: '6px 10px',
												borderRadius: '14px',
												backgroundColor: theme.variables.incomingBubbleColor,
												color: theme.variables.incomingTextColor,
												fontSize: '11px',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											}}>
											Hej! 👋
										</span>
										<span
											style={{
												flex: 1,
												padding: '6px 10px',
												borderRadius: '14px',
												backgroundColor: theme.variables.outgoingBubbleColor,
												color: theme.variables.outgoingTextColor,
												fontSize: '11px',
												textAlign: 'right',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											}}>
											Zmieńmy motyw!
										</span>
									</div>
								</div>
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
									<div>
										<strong style={{ display: 'block', fontSize: '14px' }}>{theme.name}</strong>
										<span style={{ fontSize: '12px', color: '#6c757d' }}>#{theme.key}</span>
									</div>
									{isActive && (
										<span
											style={{
												backgroundColor: '#007bff',
												color: '#ffffff',
												fontSize: '11px',
												padding: '4px 8px',
												borderRadius: '999px',
											}}>
											Aktywny
										</span>
									)}
								</div>
							</button>
						)
					})}
				</div>

				<div
					style={{
						padding: '14px 24px',
						borderTop: '1px solid #f0f0f0',
						display: 'flex',
						justifyContent: 'flex-end',
						gap: '12px',
						backgroundColor: '#fafafa',
					}}>
					<button
						onClick={onClose}
						disabled={isSaving}
						style={{
							padding: '10px 18px',
							borderRadius: '8px',
							border: '1px solid #ced4da',
							backgroundColor: '#ffffff',
							cursor: isSaving ? 'not-allowed' : 'pointer',
						}}>
						Anuluj
					</button>
				</div>
			</div>
		</div>
	)
}

export default ThemePickerModal

