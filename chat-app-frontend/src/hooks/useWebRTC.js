import { useState, useRef, useEffect, useCallback } from "react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export const useWebRTC = (
  socket,
  localUserId,
  remoteUserId,
  conversationId,
) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState(null); // 'video' or 'audio'
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [callState, setCallState] = useState("idle"); // 'idle', 'calling', 'ringing', 'connected', 'ended'

  // Device management
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState(null);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState(null);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState(null);

  // Mute states
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // Network quality
  const [networkQuality, setNetworkQuality] = useState("good"); // 'good', 'medium', 'poor'
  const [connectionStats, setConnectionStats] = useState(null);

  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const callerIdRef = useRef(null);
  const endCallRef = useRef(null);
  const isCleaningUpRef = useRef(false);
  const isInitiatingRef = useRef(false);

  // Inicjalizacja peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Dodaj strumień lokalny do peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Obsługa ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit("webrtc_ice_candidate", {
          conversationId,
          targetUserId: remoteUserId,
          candidate: event.candidate,
        });
      }
    };

    // Obsługa zdalnego strumienia
    pc.ontrack = (event) => {
      console.log("📹 Received remote track");
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    // Obsługa zmiany stanu połączenia
    pc.onconnectionstatechange = () => {
      console.log("🔗 Peer connection state:", pc.connectionState);

      // Możliwe stany: new, connecting, connected, disconnected, failed, closed
      if (pc.connectionState === "connected") {
        setCallState("connected");
        startNetworkMonitoring(pc);
      } else if (pc.connectionState === "connecting") {
        console.log("🔄 Connecting...");
        setCallState("connecting");
      } else if (pc.connectionState === "failed") {
        // Tylko failed kończy połączenie automatycznie
        console.log("❌ Connection failed, ending call");
        if (endCallRef.current && !isCleaningUpRef.current) {
          endCallRef.current();
        }
      } else if (pc.connectionState === "closed") {
        console.log("📪 Connection closed");
        // Nie wywołuj endCall - już jest zamknięte
      }
      // disconnected i new - ignorujemy, może być tymczasowe
    };

    // Obsługa ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state:", pc.iceConnectionState);

      if (pc.iceConnectionState === "disconnected") {
        setNetworkQuality("poor");
      } else if (pc.iceConnectionState === "failed") {
        setNetworkQuality("poor");
      } else if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        setNetworkQuality("good");
      }
    };

    return pc;
  }, [socket, conversationId, remoteUserId]);

  // Monitor network quality
  const startNetworkMonitoring = useCallback((pc) => {
    const monitorInterval = setInterval(async () => {
      if (!pc || pc.connectionState !== "connected") {
        clearInterval(monitorInterval);
        return;
      }

      try {
        const stats = await pc.getStats();
        let bytesReceived = 0;
        let bytesSent = 0;
        let packetsLost = 0;
        let packetsReceived = 0;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp") {
            bytesReceived += report.bytesReceived || 0;
            packetsLost += report.packetsLost || 0;
            packetsReceived += report.packetsReceived || 0;
          }
          if (report.type === "outbound-rtp") {
            bytesSent += report.bytesSent || 0;
          }
        });

        const packetLossRate =
          packetsReceived > 0 ? (packetsLost / packetsReceived) * 100 : 0;

        setConnectionStats({
          bytesReceived,
          bytesSent,
          packetsLost,
          packetsReceived,
          packetLossRate,
        });

        // Determine quality based on packet loss
        if (packetLossRate < 2) {
          setNetworkQuality("good");
        } else if (packetLossRate < 5) {
          setNetworkQuality("medium");
        } else {
          setNetworkQuality("poor");
        }
      } catch (error) {
        console.error("Error getting connection stats:", error);
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(monitorInterval);
  }, []);

  // Pobierz dostępne urządzenia
  const getAvailableDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn("enumerateDevices nie jest wspierane");
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput",
      );
      const videoInputs = devices.filter(
        (device) => device.kind === "videoinput",
      );
      const audioOutputs = devices.filter(
        (device) => device.kind === "audiooutput",
      );

      console.log("📱 Available devices:", {
        audioInputs,
        videoInputs,
        audioOutputs,
      });

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);
      setOutputDevices(audioOutputs);

      // Ustaw domyślne urządzenia jeśli nie są wybrane
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
      if (!selectedOutputDevice && audioOutputs.length > 0) {
        setSelectedOutputDevice(audioOutputs[0].deviceId);
      }
    } catch (error) {
      console.error("Błąd pobierania urządzeń:", error);
    }
  }, [selectedAudioDevice, selectedVideoDevice, selectedOutputDevice]);

  // Uzyskanie dostępu do kamery i mikrofonu
  const getLocalStream = useCallback(
    async (type = "video", audioDeviceId = null, videoDeviceId = null) => {
      try {
        // Sprawdź dostępność mediów
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Twoja przeglądarka nie obsługuje dostępu do mediów");
        }

        const constraints = {
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video:
            type === "video"
              ? videoDeviceId
                ? {
                    deviceId: { exact: videoDeviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  }
                : {
                    facingMode: { ideal: "user" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  }
              : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        localStreamRef.current = stream;
        setLocalStream(stream);

        if (localVideoRef.current && stream.getVideoTracks().length > 0) {
          localVideoRef.current.srcObject = stream;
        }

        // Po uzyskaniu dostępu, pobierz listę urządzeń
        await getAvailableDevices();

        return stream;
      } catch (error) {
        console.error("Błąd uzyskiwania dostępu do mediów:", error);

        // Bardziej przyjazny komunikat błędu
        let errorMessage = "Nie udało się uzyskać dostępu do urządzeń";
        if (
          error.name === "NotFoundError" ||
          error.name === "DevicesNotFoundError"
        ) {
          errorMessage =
            "Nie znaleziono kamery/mikrofonu. Sprawdź czy urządzenia są podłączone i włączone.";
        } else if (
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
        ) {
          errorMessage =
            "Dostęp do kamery/mikrofonu został odrzucony. Zezwól na dostęp w ustawieniach przeglądarki.";
        } else if (
          error.name === "NotReadableError" ||
          error.name === "TrackStartError"
        ) {
          errorMessage =
            "Kamera/mikrofon jest używany przez inną aplikację. Zamknij inne aplikacje i spróbuj ponownie.";
        } else if (error.name === "OverconstrainedError") {
          errorMessage =
            "Wybrane urządzenie nie jest dostępne. Spróbuj wybrać inne urządzenie.";
        }

        // Wyświetl alert użytkownikowi
        if (typeof window !== "undefined") {
          alert(errorMessage);
        }

        throw error;
      }
    },
    [getAvailableDevices],
  );

  // Zatrzymanie lokalnego strumienia
  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
  }, []);

  // Zakończenie połączenia (definiujemy wcześnie, bo jest używane w innych funkcjach)
  const endCall = useCallback(() => {
    // Zapobiegaj wielokrotnym wywołaniom
    if (isCleaningUpRef.current) {
      console.log("⚠️ Already cleaning up, skipping endCall");
      return;
    }

    isCleaningUpRef.current = true;
    console.log("🔴 Ending call - cleaning up resources");

    // Zatrzymaj lokalny strumień
    stopLocalStream();

    // Zamknij peer connection
    if (peerConnectionRef.current) {
      // Usuń event listenery przed zamknięciem
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;

      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Zatrzymaj zdalny strumień
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setRemoteStream(null);

    // Wyślij sygnał zakończenia tylko jeśli było aktywne połączenie
    // I tylko jeśli socket jest połączony
    const shouldNotify = isCallActive || isCalling || isIncomingCall;
    if (shouldNotify && socket?.connected) {
      console.log("📤 Sending end_call signal to", remoteUserId);
      socket.emit("webrtc_end_call", {
        conversationId,
        targetUserId: remoteUserId,
      });
    }

    // Reset stanu - WAŻNE: resetujemy wszystkie flagi
    setIsCallActive(false);
    setIsIncomingCall(false);
    setIsCalling(false);
    setCallState("ended");
    setCallType(null);
    callerIdRef.current = null;
    isInitiatingRef.current = false;

    // Po krótkim czasie ustaw stan na 'idle' i zezwól na kolejne połączenia
    setTimeout(() => {
      setCallState("idle");
      isCleaningUpRef.current = false;
    }, 500);
  }, [
    socket,
    conversationId,
    remoteUserId,
    stopLocalStream,
    isCallActive,
    isCalling,
    isIncomingCall,
  ]);

  // Aktualizuj ref do endCall
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Rozpoczęcie połączenia (jako inicjator)
  const startCall = useCallback(
    async (type = "video") => {
      try {
        // Zapobiegaj wielokrotnym wywołaniom startCall
        if (isInitiatingRef.current) {
          console.log("⚠️ Call already being initiated, skipping");
          return;
        }

        isInitiatingRef.current = true;
        console.log("📞 Starting call, type:", type);
        setCallType(type);
        setCallState("calling");

        // Uzyskaj dostęp do mediów PRZED ustawieniem isCalling
        await getLocalStream(type);

        // Teraz ustaw isCalling po uzyskaniu mediów
        setIsCalling(true);

        // Utwórz peer connection
        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        // Utwórz ofertę
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wyślij ofertę przez socket
        socket?.emit("webrtc_offer", {
          conversationId,
          targetUserId: remoteUserId,
          offer: pc.localDescription,
          callType: type,
        });

        console.log("📤 Offer sent to", remoteUserId);
        isInitiatingRef.current = false;
        // NIE ustawiaj isCallActive tutaj - poczekaj na odpowiedź
        // isCallActive zostanie ustawione w handleAnswer gdy otrzymamy odpowiedź
      } catch (error) {
        console.error("❌ Błąd rozpoczęcia połączenia:", error);
        // Wyczyść stan przy błędzie
        isInitiatingRef.current = false;
        stopLocalStream();
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        setIsCalling(false);
        setCallState("idle");
        setCallType(null);
        throw error;
      }
    },
    [
      socket,
      conversationId,
      remoteUserId,
      getLocalStream,
      createPeerConnection,
      stopLocalStream,
    ],
  );

  // Odebranie oferty (jako odbiorca)
  const handleOffer = useCallback(
    async (offer, callerId, callTypeReceived) => {
      try {
        console.log(
          "📥 Received offer from",
          callerId,
          "type:",
          callTypeReceived,
        );

        // Jeśli już mamy aktywne połączenie lub czyścimy, ignoruj nową ofertę
        if (
          isCallActive ||
          isCalling ||
          isIncomingCall ||
          isCleaningUpRef.current ||
          isInitiatingRef.current
        ) {
          console.log("⚠️ Already in a call or cleaning up, ignoring offer");
          return;
        }

        setCallType(callTypeReceived || "video");
        setIsIncomingCall(true);
        setCallState("ringing");
        callerIdRef.current = callerId; // Zapisz ID inicjatora

        // Utwórz peer connection (bez lokalnego strumienia na razie)
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Obsługa ICE candidate
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket?.emit("webrtc_ice_candidate", {
              conversationId,
              targetUserId: callerId,
              candidate: event.candidate,
            });
          }
        };

        // Obsługa zdalnego strumienia
        pc.ontrack = (event) => {
          console.log("📹 Received remote track");
          const [remoteStream] = event.streams;
          setRemoteStream(remoteStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        };

        // Obsługa zmiany stanu połączenia
        pc.onconnectionstatechange = () => {
          console.log("🔗 Peer connection state:", pc.connectionState);

          // Możliwe stany: new, connecting, connected, disconnected, failed, closed
          if (pc.connectionState === "connected") {
            setCallState("connected");
          } else if (pc.connectionState === "connecting") {
            console.log("🔄 Connecting...");
            setCallState("connecting");
          } else if (pc.connectionState === "failed") {
            // Tylko failed kończy połączenie automatycznie
            console.log("❌ Connection failed, ending call");
            if (endCallRef.current && !isCleaningUpRef.current) {
              endCallRef.current();
            }
          } else if (pc.connectionState === "closed") {
            console.log("📪 Connection closed");
            // Nie wywołuj endCall - już jest zamknięte
          }
          // disconnected i new - ignorujemy, może być tymczasowe
        };

        peerConnectionRef.current = pc;

        // Ustaw zdalną ofertę
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // NIE tworzymy odpowiedzi tutaj - poczekamy na akceptację użytkownika
        // Odpowiedź zostanie utworzona w acceptCall po uzyskaniu dostępu do mediów
      } catch (error) {
        console.error("❌ Błąd obsługi oferty:", error);
        if (endCallRef.current && !isCleaningUpRef.current) {
          endCallRef.current();
        }
      }
    },
    [socket, conversationId, isCallActive, isCalling, isIncomingCall],
  );

  // Odebranie odpowiedzi
  const handleAnswer = useCallback(async (answer) => {
    try {
      console.log("📥 Received answer");
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
        setIsCalling(false);
        setIsCallActive(true);
        setCallState("connected");
        console.log("✅ Call connected");
      }
    } catch (error) {
      console.error("❌ Błąd obsługi odpowiedzi:", error);
      if (endCallRef.current && !isCleaningUpRef.current) {
        endCallRef.current();
      }
    }
  }, []);

  // Odebranie ICE candidate
  const handleIceCandidate = useCallback(async (candidate) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate),
        );
      }
    } catch (error) {
      console.error("Błąd dodawania ICE candidate:", error);
    }
  }, []);

  // Odrzucenie połączenia
  const rejectCall = useCallback(() => {
    console.log("❌ Rejecting call");
    const targetId = callerIdRef.current || remoteUserId;

    socket?.emit("webrtc_reject", {
      conversationId,
      targetUserId: targetId,
    });

    if (endCallRef.current && !isCleaningUpRef.current) {
      endCallRef.current();
    }
  }, [socket, conversationId, remoteUserId]);

  // Akceptacja przychodzącego połączenia
  const acceptCall = useCallback(async () => {
    try {
      console.log("✅ Accepting call");
      if (!peerConnectionRef.current) {
        console.error("❌ No peer connection");
        return;
      }

      // Uzyskaj dostęp do mediów
      try {
        await getLocalStream(callType);
      } catch (mediaError) {
        console.error(
          "❌ Błąd uzyskiwania dostępu do mediów przy akceptacji:",
          mediaError,
        );
        // Jeśli nie udało się uzyskać dostępu, zakończ połączenie
        if (endCallRef.current && !isCleaningUpRef.current) {
          endCallRef.current();
        }
        return;
      }

      // Dodaj ścieżki do peer connection
      if (localStreamRef.current && peerConnectionRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      }

      // Utwórz odpowiedź (teraz gdy mamy lokalny strumień)
      if (peerConnectionRef.current.remoteDescription) {
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        // Wyślij odpowiedź do inicjatora (użyj zapisanego callerId lub remoteUserId jako fallback)
        const targetId = callerIdRef.current || remoteUserId;
        console.log("📤 Sending answer to", targetId);
        socket?.emit("webrtc_answer", {
          conversationId,
          targetUserId: targetId,
          answer: peerConnectionRef.current.localDescription,
        });
      }

      setIsIncomingCall(false);
      setIsCallActive(true);
      setCallState("connected");
      console.log("✅ Call accepted and connected");
    } catch (error) {
      console.error("❌ Błąd akceptacji połączenia:", error);
      if (endCallRef.current && !isCleaningUpRef.current) {
        endCallRef.current();
      }
    }
  }, [callType, getLocalStream, socket, conversationId, remoteUserId]);

  // Przełączanie mikrofonu
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      const newMutedState =
        audioTracks.length > 0 ? !audioTracks[0].enabled : false;
      setIsAudioMuted(newMutedState);
      console.log(newMutedState ? "🔇 Audio muted" : "🔊 Audio unmuted");
    }
  }, []);

  // Przełączanie kamery (tylko dla wideo)
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current && callType === "video") {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      const newMutedState =
        videoTracks.length > 0 ? !videoTracks[0].enabled : false;
      setIsVideoMuted(newMutedState);
      console.log(newMutedState ? "📹 Video disabled" : "📹 Video enabled");
    }
  }, [callType]);

  // Zmiana urządzenia audio
  const changeAudioDevice = useCallback(
    async (deviceId) => {
      try {
        console.log("🎤 Changing audio device to:", deviceId);
        setSelectedAudioDevice(deviceId);

        if (!localStreamRef.current) return;

        // Pobierz nowy strumień z wybranym urządzeniem
        const newConstraints = {
          audio: { deviceId: { exact: deviceId } },
          video: callType === "video",
        };

        const newStream =
          await navigator.mediaDevices.getUserMedia(newConstraints);

        // Zamień ścieżki audio w peer connection
        if (peerConnectionRef.current) {
          const audioTrack = newStream.getAudioTracks()[0];
          const senders = peerConnectionRef.current.getSenders();
          const audioSender = senders.find(
            (sender) => sender.track?.kind === "audio",
          );

          if (audioSender) {
            await audioSender.replaceTrack(audioTrack);
          }
        }

        // Zatrzymaj stare ścieżki audio
        localStreamRef.current
          .getAudioTracks()
          .forEach((track) => track.stop());

        // Usuń stare ścieżki audio i dodaj nowe
        localStreamRef.current
          .getAudioTracks()
          .forEach((track) => localStreamRef.current.removeTrack(track));
        localStreamRef.current.addTrack(newStream.getAudioTracks()[0]);

        setLocalStream(localStreamRef.current);
        console.log("✅ Audio device changed successfully");
      } catch (error) {
        console.error("❌ Error changing audio device:", error);
        alert("Nie udało się zmienić mikrofonu: " + error.message);
      }
    },
    [callType],
  );

  // Zmiana urządzenia video
  const changeVideoDevice = useCallback(
    async (deviceId) => {
      try {
        console.log("📹 Changing video device to:", deviceId);
        setSelectedVideoDevice(deviceId);

        if (!localStreamRef.current || callType !== "video") return;

        // Pobierz nowy strumień z wybraną kamerą
        const newConstraints = {
          audio: false,
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        const newStream =
          await navigator.mediaDevices.getUserMedia(newConstraints);

        // Zamień ścieżki video w peer connection
        if (peerConnectionRef.current) {
          const videoTrack = newStream.getVideoTracks()[0];
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(
            (sender) => sender.track?.kind === "video",
          );

          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
          }
        }

        // Zatrzymaj stare ścieżki video
        localStreamRef.current
          .getVideoTracks()
          .forEach((track) => track.stop());

        // Usuń stare ścieżki video i dodaj nowe
        localStreamRef.current
          .getVideoTracks()
          .forEach((track) => localStreamRef.current.removeTrack(track));
        localStreamRef.current.addTrack(newStream.getVideoTracks()[0]);

        // Zaktualizuj preview
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setLocalStream(localStreamRef.current);
        console.log("✅ Video device changed successfully");
      } catch (error) {
        console.error("❌ Error changing video device:", error);
        alert("Nie udało się zmienić kamery: " + error.message);
      }
    },
    [callType],
  );

  // Zmiana urządzenia output (głośniki)
  const changeOutputDevice = useCallback(async (deviceId) => {
    try {
      console.log("🔊 Changing output device to:", deviceId);
      setSelectedOutputDevice(deviceId);

      // Zmień output device dla remote video
      if (
        remoteVideoRef.current &&
        typeof remoteVideoRef.current.setSinkId === "function"
      ) {
        await remoteVideoRef.current.setSinkId(deviceId);
        console.log("✅ Output device changed successfully");
      } else {
        console.warn("⚠️ setSinkId not supported in this browser");
      }
    } catch (error) {
      console.error("❌ Error changing output device:", error);
      alert("Nie udało się zmienić głośników: " + error.message);
    }
  }, []);

  // Nasłuchiwanie na eventy WebRTC
  useEffect(() => {
    if (!socket) return;

    const handleWebRTCOffer = (data) => {
      if (
        data.fromUserId === remoteUserId &&
        data.conversationId === conversationId
      ) {
        handleOffer(data.offer, data.fromUserId, data.callType);
      }
    };

    const handleWebRTCAnswer = (data) => {
      if (
        data.fromUserId === remoteUserId &&
        data.conversationId === conversationId
      ) {
        handleAnswer(data.answer);
      }
    };

    const handleWebRTCIceCandidate = (data) => {
      if (
        data.fromUserId === remoteUserId &&
        data.conversationId === conversationId
      ) {
        handleIceCandidate(data.candidate);
      }
    };

    const handleWebRTCEndCall = (data) => {
      if (
        data.fromUserId === remoteUserId &&
        data.conversationId === conversationId
      ) {
        console.log("📞 Remote user ended call");
        // Tylko wywołaj endCall jeśli mamy już ustanowione połączenie
        // lub jesteśmy w trakcie łączenia
        if (isCallActive || isCalling || isIncomingCall) {
          if (endCallRef.current && !isCleaningUpRef.current) {
            endCallRef.current();
          }
        } else {
          console.log("⚠️ Ignoring end_call - no active call session");
        }
      }
    };

    const handleWebRTCReject = (data) => {
      if (
        data.fromUserId === remoteUserId &&
        data.conversationId === conversationId
      ) {
        console.log("❌ Remote user rejected call");
        // Odrzucenie zawsze powinno kończyć połączenie
        if (endCallRef.current && !isCleaningUpRef.current) {
          endCallRef.current();
        }
      }
    };

    socket.on("webrtc_offer", handleWebRTCOffer);
    socket.on("webrtc_answer", handleWebRTCAnswer);
    socket.on("webrtc_ice_candidate", handleWebRTCIceCandidate);
    socket.on("webrtc_end_call", handleWebRTCEndCall);
    socket.on("webrtc_reject", handleWebRTCReject);

    return () => {
      socket.off("webrtc_offer", handleWebRTCOffer);
      socket.off("webrtc_answer", handleWebRTCAnswer);
      socket.off("webrtc_ice_candidate", handleWebRTCIceCandidate);
      socket.off("webrtc_end_call", handleWebRTCEndCall);
      socket.off("webrtc_reject", handleWebRTCReject);
    };
  }, [
    socket,
    remoteUserId,
    conversationId,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
  ]);

  // Cleanup przy odmontowaniu
  useEffect(() => {
    return () => {
      if (endCallRef.current) {
        endCallRef.current();
      }
    };
  }, []);

  return {
    // Stan
    isCallActive,
    isIncomingCall,
    isCalling,
    callType,
    callState,
    localStream,
    remoteStream,

    // Device management
    audioDevices,
    videoDevices,
    outputDevices,
    selectedAudioDevice,
    selectedVideoDevice,
    selectedOutputDevice,
    isAudioMuted,
    isVideoMuted,
    networkQuality,
    connectionStats,

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
    changeAudioDevice,
    changeVideoDevice,
    changeOutputDevice,
    getAvailableDevices,
  };
};
