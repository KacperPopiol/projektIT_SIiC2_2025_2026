import { useState, useRef, useEffect, useCallback } from 'react'

const ICE_SERVERS = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
		{ urls: 'stun:stun2.l.google.com:19302' },
	],
}

export const useWebRTC = (socket, localUserId, remoteUserId, conversationId) => {
	const [isCallActive, setIsCallActive] = useState(false)
	const [isIncomingCall, setIsIncomingCall] = useState(false)
	const [isCalling, setIsCalling] = useState(false)
	const [callType, setCallType] = useState(null) // 'video' or 'audio'
	const [remoteStream, setRemoteStream] = useState(null)
	const [localStream, setLocalStream] = useState(null)
	const [callState, setCallState] = useState('idle') // 'idle', 'calling', 'ringing', 'connected', 'ended'

	const peerConnectionRef = useRef(null)
	const localVideoRef = useRef(null)
	const remoteVideoRef = useRef(null)
	const localStreamRef = useRef(null)

	// Inicjalizacja peer connection
	const createPeerConnection = useCallback(() => {
		const pc = new RTCPeerConnection(ICE_SERVERS)

		// Dodaj strumień lokalny do peer connection
		if (localStreamRef.current) {
			localStreamRef.current.getTracks().forEach(track => {
				pc.addTrack(track, localStreamRef.current)
			})
		}

		// Obsługa ICE candidate
		pc.onicecandidate = event => {
			if (event.candidate) {
				socket?.emit('webrtc_ice_candidate', {
					conversationId,
					targetUserId: remoteUserId,
					candidate: event.candidate,
				})
			}
		}

		// Obsługa zdalnego strumienia
		pc.ontrack = event => {
			const [remoteStream] = event.streams
			setRemoteStream(remoteStream)
			if (remoteVideoRef.current) {
				remoteVideoRef.current.srcObject = remoteStream
			}
		}

		// Obsługa zmiany stanu połączenia
		pc.onconnectionstatechange = () => {
			console.log('Peer connection state:', pc.connectionState)
			if (pc.connectionState === 'connected') {
				setCallState('connected')
			} else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
				endCall()
			}
		}

		return pc
	}, [socket, conversationId, remoteUserId])

	// Uzyskanie dostępu do kamery i mikrofonu
	const getLocalStream = useCallback(async (type = 'video') => {
		try {
			// Sprawdź dostępność mediów
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				throw new Error('Twoja przeglądarka nie obsługuje dostępu do mediów')
			}

			const constraints = {
				audio: true,
				video: type === 'video' ? { 
					facingMode: { ideal: 'user' },
					width: { ideal: 1280 },
					height: { ideal: 720 }
				} : false,
			}

			const stream = await navigator.mediaDevices.getUserMedia(constraints)

			localStreamRef.current = stream
			setLocalStream(stream)

			if (localVideoRef.current && stream.getVideoTracks().length > 0) {
				localVideoRef.current.srcObject = stream
			}

			return stream
		} catch (error) {
			console.error('Błąd uzyskiwania dostępu do mediów:', error)
			
			// Bardziej przyjazny komunikat błędu
			let errorMessage = 'Nie udało się uzyskać dostępu do urządzeń'
			if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
				errorMessage = 'Nie znaleziono kamery/mikrofonu. Sprawdź czy urządzenia są podłączone i włączone.'
			} else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
				errorMessage = 'Dostęp do kamery/mikrofonu został odrzucony. Zezwól na dostęp w ustawieniach przeglądarki.'
			} else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
				errorMessage = 'Kamera/mikrofon jest używany przez inną aplikację. Zamknij inne aplikacje i spróbuj ponownie.'
			}
			
			// Wyświetl alert użytkownikowi
			if (typeof window !== 'undefined') {
				alert(errorMessage)
			}
			
			throw error
		}
	}, [])

	// Zatrzymanie lokalnego strumienia
	const stopLocalStream = useCallback(() => {
		if (localStreamRef.current) {
			localStreamRef.current.getTracks().forEach(track => track.stop())
			localStreamRef.current = null
			setLocalStream(null)
			if (localVideoRef.current) {
				localVideoRef.current.srcObject = null
			}
		}
	}, [])

	// Zakończenie połączenia (definiujemy wcześnie, bo jest używane w innych funkcjach)
	const endCall = useCallback(() => {
		// Zatrzymaj lokalny strumień
		stopLocalStream()

		// Zamknij peer connection
		if (peerConnectionRef.current) {
			peerConnectionRef.current.close()
			peerConnectionRef.current = null
		}

		// Zatrzymaj zdalny strumień
		if (remoteVideoRef.current) {
			remoteVideoRef.current.srcObject = null
		}

		// Wyślij sygnał zakończenia
		socket?.emit('webrtc_end_call', {
			conversationId,
			targetUserId: remoteUserId,
		})

		// Reset stanu
		setIsCallActive(false)
		setIsIncomingCall(false)
		setIsCalling(false)
		setCallState('idle')
		setRemoteStream(null)
		setCallType(null)
	}, [socket, conversationId, remoteUserId, stopLocalStream])

	// Rozpoczęcie połączenia (jako inicjator)
	const startCall = useCallback(async (type = 'video') => {
		try {
			setCallType(type)
			setIsCalling(true)
			setCallState('calling')

			// Uzyskaj dostęp do mediów
			await getLocalStream(type)

			// Utwórz peer connection
			const pc = createPeerConnection()
			peerConnectionRef.current = pc

			// Utwórz ofertę
			const offer = await pc.createOffer()
			await pc.setLocalDescription(offer)

			// Wyślij ofertę przez socket
			socket?.emit('webrtc_offer', {
				conversationId,
				targetUserId: remoteUserId,
				offer: pc.localDescription,
				callType: type,
			})

			setIsCallActive(true)
		} catch (error) {
			console.error('Błąd rozpoczęcia połączenia:', error)
			endCall()
			throw error
		}
	}, [socket, conversationId, remoteUserId, getLocalStream, createPeerConnection, endCall])

	// Odebranie oferty (jako odbiorca)
	const handleOffer = useCallback(
		async (offer, callerId, callTypeReceived) => {
			try {
				setCallType(callTypeReceived || 'video')
				setIsIncomingCall(true)
				setCallState('ringing')

				// Utwórz peer connection
				const pc = createPeerConnection()
				peerConnectionRef.current = pc

				// Ustaw zdalną ofertę
				await pc.setRemoteDescription(new RTCSessionDescription(offer))

				// Utwórz odpowiedź
				const answer = await pc.createAnswer()
				await pc.setLocalDescription(answer)

				// Wyślij odpowiedź przez socket
				socket?.emit('webrtc_answer', {
					conversationId,
					targetUserId: callerId,
					answer: pc.localDescription,
				})
		} catch (error) {
			console.error('Błąd obsługi oferty:', error)
			endCall()
		}
	},
		[socket, conversationId, createPeerConnection, endCall]
	)

	// Odebranie odpowiedzi
	const handleAnswer = useCallback(
		async answer => {
			try {
				if (peerConnectionRef.current) {
					await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
					setCallState('connected')
				}
			} catch (error) {
				console.error('Błąd obsługi odpowiedzi:', error)
				endCall()
			}
		},
		[endCall]
	)

	// Odebranie ICE candidate
	const handleIceCandidate = useCallback(
		async candidate => {
			try {
				if (peerConnectionRef.current) {
					await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
				}
			} catch (error) {
				console.error('Błąd dodawania ICE candidate:', error)
			}
		},
		[]
	)

	// Akceptacja przychodzącego połączenia
	const acceptCall = useCallback(async () => {
		try {
			if (!peerConnectionRef.current) return

			// Uzyskaj dostęp do mediów
			try {
				await getLocalStream(callType)
			} catch (mediaError) {
				console.error('Błąd uzyskiwania dostępu do mediów przy akceptacji:', mediaError)
				// Kontynuuj nawet jeśli nie ma mediów - użytkownik będzie mógł tylko słuchać
				// endCall() // Opcjonalnie: odrzuć połączenie jeśli nie ma mediów
			}

			setIsIncomingCall(false)
			setIsCallActive(true)
			setCallState('connected')
		} catch (error) {
			console.error('Błąd akceptacji połączenia:', error)
			endCall()
		}
	}, [callType, getLocalStream, endCall])

	// Odrzucenie połączenia
	const rejectCall = useCallback(() => {
		if (peerConnectionRef.current) {
			socket?.emit('webrtc_reject', {
				conversationId,
				targetUserId: remoteUserId,
			})
		}
		endCall()
	}, [socket, conversationId, remoteUserId, endCall])

	// Przełączanie mikrofonu
	const toggleMute = useCallback(() => {
		if (localStreamRef.current) {
			localStreamRef.current.getAudioTracks().forEach(track => {
				track.enabled = !track.enabled
			})
		}
	}, [])

	// Przełączanie kamery (tylko dla wideo)
	const toggleVideo = useCallback(() => {
		if (localStreamRef.current && callType === 'video') {
			localStreamRef.current.getVideoTracks().forEach(track => {
				track.enabled = !track.enabled
			})
		}
	}, [callType])

	// Nasłuchiwanie na eventy WebRTC
	useEffect(() => {
		if (!socket) return

		const handleWebRTCOffer = data => {
			if (data.fromUserId === remoteUserId && data.conversationId === conversationId) {
				handleOffer(data.offer, data.fromUserId, data.callType)
			}
		}

		const handleWebRTCAnswer = data => {
			if (data.fromUserId === remoteUserId && data.conversationId === conversationId) {
				handleAnswer(data.answer)
			}
		}

		const handleWebRTCIceCandidate = data => {
			if (data.fromUserId === remoteUserId && data.conversationId === conversationId) {
				handleIceCandidate(data.candidate)
			}
		}

		const handleWebRTCEndCall = data => {
			if (data.fromUserId === remoteUserId && data.conversationId === conversationId) {
				endCall()
			}
		}

		const handleWebRTCReject = data => {
			if (data.fromUserId === remoteUserId && data.conversationId === conversationId) {
				endCall()
			}
		}

		socket.on('webrtc_offer', handleWebRTCOffer)
		socket.on('webrtc_answer', handleWebRTCAnswer)
		socket.on('webrtc_ice_candidate', handleWebRTCIceCandidate)
		socket.on('webrtc_end_call', handleWebRTCEndCall)
		socket.on('webrtc_reject', handleWebRTCReject)

		return () => {
			socket.off('webrtc_offer', handleWebRTCOffer)
			socket.off('webrtc_answer', handleWebRTCAnswer)
			socket.off('webrtc_ice_candidate', handleWebRTCIceCandidate)
			socket.off('webrtc_end_call', handleWebRTCEndCall)
			socket.off('webrtc_reject', handleWebRTCReject)
		}
	}, [socket, remoteUserId, conversationId, handleOffer, handleAnswer, handleIceCandidate, endCall])

	// Cleanup przy odmontowaniu
	useEffect(() => {
		return () => {
			endCall()
		}
	}, [endCall])

	return {
		// Stan
		isCallActive,
		isIncomingCall,
		isCalling,
		callType,
		callState,
		localStream,
		remoteStream,

		// Referencje
		localVideoRef,
		remoteVideoRef,

		// Funkcje
		startCall,
		acceptCall,
		rejectCall,
		endCall,
		toggleMute,
		toggleVideo,
	}
}

