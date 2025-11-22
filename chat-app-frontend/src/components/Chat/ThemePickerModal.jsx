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

const modalStyles = {
	width: '100%',
	maxWidth: '620px',
	maxHeight: '80vh',
	borderRadius: '16px',
	backgroundColor: 'var(--card-bg)',
	boxShadow: 'var(--shadow-md)',
	overflowY: 'hidden',
	display: 'flex',
	flexDirection: 'column',
	border: `1px solid var(--color-border)`
}

const headerStyles = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	padding: '20px 24px',
	borderBottom: '1px solid var(--color-border)',
	backgroundColor: 'var(--color-surface)'
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
			<div style={modalStyles} onClick={e => e.stopPropagation()}>
				<div style={headerStyles}>
					<div>
						<h2 style={{ margin: 0 }}>Wybierz motyw rozmowy</h2>
						<p style={{ margin: '6px 0 0 0', color: 'var(--color-text-muted)', fontSize: '14px' }}>
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
							color: 'var(--color-text-muted)',
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
									border: isActive ? `2px solid var(--color-accent)` : `1px solid var(--color-border)`,
									borderRadius: '12px',
									padding: '16px',
									backgroundColor: 'var(--color-surface)',
									color: 'var(--color-text-primary)',
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
										<span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>#{theme.key}</span>
									</div>
									{isActive && (
										<span
											style={{
												padding: '4px 10px',
												borderRadius: '999px',
												backgroundColor: 'var(--color-accent)',
												color: 'var(--color-accent-contrast)',
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
						borderTop: '1px solid var(--color-border)',
						display: 'flex',
						justifyContent: 'flex-end',
						gap: '12px',
						backgroundColor: 'var(--color-elevated)',
					}}>
					<button
						onClick={onClose}
						disabled={isSaving}
						style={{
							padding: '10px 18px',
							borderRadius: '8px',
							color: 'var(--color-text-primary)',
							border: '1px solid var(--color-border)',
							backgroundColor: 'var(--color-surface)',
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

