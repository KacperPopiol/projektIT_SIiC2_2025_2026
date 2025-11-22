import { useEffect } from 'react'

const VideoCall = ({
	conversation,
	remoteUserId,
	isCallActive,
	isIncomingCall,
	isCalling,
	callType,
	callState,
	localVideoRef,
	remoteVideoRef,
	acceptCall,
	rejectCall,
	endCall,
	toggleMute,
	toggleVideo,
	onClose,
}) => {

	const ui = {
		bg: 'var(--color-bg)',
		surface: 'var(--color-surface)',
		border: 'var(--color-border)',
		textPrimary: 'var(--color-text-primary)',
		textSecondary: 'var(--color-text-secondary)',
		accent: 'var(--color-accent)',
		accentText: 'var(--button-primary-text)',
		danger: 'var(--button-danger-bg)',
		dangerText: 'var(--button-danger-text)',
		success: 'var(--button-success-bg)',
		successText: 'var(--button-success-text)',
	}

	// Zamykanie przy końcu połączenia
	useEffect(() => {
		if (callState === 'ended' || callState === 'idle') {
			const timer = setTimeout(() => {
				if (!isCallActive && !isIncomingCall && !isCalling) {
					onClose?.()
				}
			}, 1000)
			return () => clearTimeout(timer)
		}
	}, [callState, isCallActive, isIncomingCall, isCalling, onClose])

	// Ekran przychodzącego połączenia
	if (isIncomingCall) {
		return (
			<div
				style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: 'rgba(0, 0, 0, 0.9)',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					zIndex: 10000,
					color: ui.textPrimary,
				}}>
				<div
					style={{
						textAlign: 'center',
						marginBottom: '40px',
					}}>
					<div
						style={{
							fontSize: '72px',
							marginBottom: '20px',
							animation: 'pulse 2s infinite',
						}}>
						{callType === 'video' ? '📹' : '📞'}
					</div>
					<h2 style={{ fontSize: '28px', marginBottom: '10px' }}>
						Przychodzące połączenie {callType === 'video' ? 'wideo' : 'głosowe'}
					</h2>
					<p style={{ fontSize: '16px', color: ui.textSecondary }}>
						{conversation?.name || 'Użytkownik'}
					</p>
				</div>

				<div
					style={{
						display: 'flex',
						gap: '20px',
					}}>
					<button
						onClick={rejectCall}
						style={{
							width: '70px',
							height: '70px',
							borderRadius: '50%',
							backgroundColor: ui.danger,
							color: ui.dangerText,
							border: 'none',
							fontSize: '28px',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
						}}>
						📞
					</button>
					<button
						onClick={acceptCall}
						style={{
							width: '70px',
							height: '70px',
							borderRadius: '50%',
							backgroundColor: ui.success,
							color: ui.successText,
							border: 'none',
							fontSize: '28px',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
						}}>
						✓
					</button>
				</div>

				<style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
        `}</style>
			</div>
		)
	}

	// Ekran dzwonienia
	if (isCalling && !isCallActive) {
		return (
			<div
				style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: 'rgba(0, 0, 0, 0.9)',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					zIndex: 10000,
					color: ui.textPrimary,
				}}>
				<div
					style={{
						textAlign: 'center',
						marginBottom: '40px',
					}}>
					<div
						style={{
							fontSize: '72px',
							marginBottom: '20px',
							animation: 'pulse 2s infinite',
						}}>
						{callType === 'video' ? '📹' : '📞'}
					</div>
					<h2 style={{ fontSize: '28px', marginBottom: '10px' }}>
						Dzwonienie do {conversation?.name || 'użytkownika'}...
					</h2>
					<p style={{ fontSize: '16px', color: ui.textSecondary }}>Czekam na odpowiedź</p>
				</div>

				<button
					onClick={endCall}
					style={{
						width: '70px',
						height: '70px',
						borderRadius: '50%',
						backgroundColor: ui.danger,
						color: ui.dangerText,
						border: 'none',
						fontSize: '28px',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
					}}>
					📞
				</button>

				<style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
        `}</style>
			</div>
		)
	}

	// Ekran aktywnego połączenia
	if (isCallActive) {
		return (
			<div
				style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: '#000',
					display: 'flex',
					flexDirection: 'column',
					zIndex: 10000,
				}}>
				{/* Zdalne wideo (główny widok) */}
				<div
					style={{
						flex: 1,
						position: 'relative',
						backgroundColor: '#000',
					}}>
					{callType === 'video' ? (
						<video
							ref={remoteVideoRef}
							autoPlay
							playsInline
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'contain',
							}}
						/>
					) : (
						<div
							style={{
								width: '100%',
								height: '100%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								flexDirection: 'column',
								color: ui.textPrimary,
							}}>
							<div style={{ fontSize: '120px', marginBottom: '20px' }}>📞</div>
							<h2 style={{ fontSize: '24px' }}>{conversation?.name || 'Użytkownik'}</h2>
							<p style={{ fontSize: '14px', color: ui.textSecondary, marginTop: '10px' }}>
								Połączenie głosowe
							</p>
						</div>
					)}

					{/* Lokalne wideo (miniatura) - tylko dla wideo */}
					{callType === 'video' && (
						<div
							style={{
								position: 'absolute',
								top: '20px',
								right: '20px',
								width: '150px',
								height: '200px',
								borderRadius: '10px',
								overflow: 'hidden',
								border: '3px solid #fff',
								backgroundColor: '#000',
								boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
							}}>
							<video
								ref={localVideoRef}
								autoPlay
								playsInline
								muted
								style={{
									width: '100%',
									height: '100%',
									objectFit: 'cover',
								}}
							/>
						</div>
					)}
				</div>

				{/* Kontrolki */}
				<div
					style={{
						padding: '20px',
						backgroundColor: 'rgba(0, 0, 0, 0.7)',
						display: 'flex',
						justifyContent: 'center',
						gap: '15px',
						alignItems: 'center',
					}}>
					{callType === 'video' && (
						<button
							onClick={toggleVideo}
							style={{
								width: '50px',
								height: '50px',
								borderRadius: '50%',
								backgroundColor: 'rgba(255, 255, 255, 0.2)',
								color: '#fff',
								border: 'none',
								fontSize: '20px',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
							title="Przełącz kamerę">
							📹
						</button>
					)}

					<button
						onClick={toggleMute}
						style={{
							width: '50px',
							height: '50px',
							borderRadius: '50%',
							backgroundColor: 'rgba(255, 255, 255, 0.2)',
							color: '#fff',
							border: 'none',
							fontSize: '20px',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
						title="Wycisz mikrofon">
						🎤
					</button>

					<button
						onClick={endCall}
						style={{
							width: '60px',
							height: '60px',
							borderRadius: '50%',
							backgroundColor: ui.danger,
							color: ui.dangerText,
							border: 'none',
							fontSize: '24px',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
						}}
						title="Zakończ połączenie">
						📞
					</button>
				</div>

				{/* Status */}
				<div
					style={{
						position: 'absolute',
						top: '20px',
						left: '20px',
						padding: '8px 16px',
						backgroundColor: 'rgba(0, 0, 0, 0.6)',
						borderRadius: '20px',
						color: '#fff',
						fontSize: '14px',
					}}>
					{callState === 'connected' ? '🟢 Połączono' : callState === 'connecting' ? '🟡 Łączenie...' : '⏳'}
				</div>
			</div>
		)
	}

	// Fallback - nie powinno się tu dostać
	return null
}

export default VideoCall

