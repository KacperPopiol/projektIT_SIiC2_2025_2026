import { useEffect, useState, useRef } from "react";

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
  isInitiating = false,
  // Device management props
  audioDevices = [],
  videoDevices = [],
  outputDevices = [],
  selectedAudioDevice,
  selectedVideoDevice,
  selectedOutputDevice,
  isAudioMuted = false,
  isVideoMuted = false,
  changeAudioDevice,
  changeVideoDevice,
  changeOutputDevice,
  networkQuality = "good",
  connectionStats = null,
}) => {
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  const ui = {
    bg: "var(--color-bg)",
    surface: "var(--color-surface)",
    border: "var(--color-border)",
    textPrimary: "var(--color-text-primary)",
    textSecondary: "var(--color-text-secondary)",
    accent: "var(--color-accent)",
    accentText: "var(--button-primary-text)",
    danger: "var(--button-danger-bg)",
    dangerText: "var(--button-danger-text)",
    success: "var(--button-success-bg)",
    successText: "var(--button-success-text)",
  };

  // Audio level monitoring
  useEffect(() => {
    if (!localVideoRef?.current?.srcObject || isAudioMuted) {
      setAudioLevel(0);
      return;
    }

    const stream = localVideoRef.current.srcObject;
    const audioTracks = stream.getAudioTracks();

    if (audioTracks.length === 0) {
      setAudioLevel(0);
      return;
    }

    try {
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 512;

      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalized = Math.min(100, (average / 128) * 100);
        setAudioLevel(normalized);
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
    } catch (error) {
      console.error("Error setting up audio monitoring:", error);
    }
  }, [localVideoRef, isAudioMuted]);

  // Zamykanie jest obsługiwane w VideoCallContainer, aby uniknąć konfliktów

  // Ekran inicjowania połączenia (przed uzyskaniem dostępu do mediów)
  if (isInitiating && !isCalling && !isCallActive && !isIncomingCall) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10000,
          color: ui.textPrimary,
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              marginBottom: "20px",
              animation: "pulse 2s infinite",
            }}
          >
            {callType === "video" ? "📹" : "📞"}
          </div>
          <h2 style={{ fontSize: "28px", marginBottom: "10px" }}>
            Przygotowywanie połączenia...
          </h2>
          <p style={{ fontSize: "16px", color: ui.textSecondary }}>
            Proszę zezwolić na dostęp do{" "}
            {callType === "video" ? "kamery i mikrofonu" : "mikrofonu"}
          </p>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }

  // Ekran przychodzącego połączenia
  if (isIncomingCall) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10000,
          color: ui.textPrimary,
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              marginBottom: "20px",
              animation: "pulse 2s infinite",
            }}
          >
            {callType === "video" ? "📹" : "📞"}
          </div>
          <h2 style={{ fontSize: "28px", marginBottom: "10px" }}>
            Przychodzące połączenie {callType === "video" ? "wideo" : "głosowe"}
          </h2>
          <p style={{ fontSize: "16px", color: ui.textSecondary }}>
            {conversation?.name || "Użytkownik"}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "20px",
          }}
        >
          <button
            onClick={rejectCall}
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              backgroundColor: ui.danger,
              color: ui.dangerText,
              border: "none",
              fontSize: "28px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            📞
          </button>
          <button
            onClick={acceptCall}
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              backgroundColor: ui.success,
              color: ui.successText,
              border: "none",
              fontSize: "28px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
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
    );
  }

  // Ekran dzwonienia
  if (isCalling && !isCallActive) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10000,
          color: ui.textPrimary,
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              marginBottom: "20px",
              animation: "pulse 2s infinite",
            }}
          >
            {callType === "video" ? "📹" : "📞"}
          </div>
          <h2 style={{ fontSize: "28px", marginBottom: "10px" }}>
            Dzwonienie do {conversation?.name || "użytkownika"}...
          </h2>
          <p style={{ fontSize: "16px", color: ui.textSecondary }}>
            Czekam na odpowiedź
          </p>
        </div>

        <button
          onClick={endCall}
          style={{
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            backgroundColor: ui.danger,
            color: ui.dangerText,
            border: "none",
            fontSize: "28px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          📞
        </button>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }

  // Ekran aktywnego połączenia
  if (isCallActive) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#000",
          display: "flex",
          flexDirection: "column",
          zIndex: 10000,
        }}
      >
        {/* Zdalne wideo (główny widok) */}
        <div
          style={{
            flex: 1,
            position: "relative",
            backgroundColor: "#000",
          }}
        >
          {callType === "video" ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                color: ui.textPrimary,
              }}
            >
              <div style={{ fontSize: "120px", marginBottom: "20px" }}>📞</div>
              <h2 style={{ fontSize: "24px" }}>
                {conversation?.name || "Użytkownik"}
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  color: ui.textSecondary,
                  marginTop: "10px",
                }}
              >
                Połączenie głosowe
              </p>
            </div>
          )}

          {/* Lokalne wideo (miniatura) - tylko dla wideo */}
          {callType === "video" && (
            <div
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                width: "150px",
                height: "200px",
                borderRadius: "10px",
                overflow: "hidden",
                border: "3px solid #fff",
                backgroundColor: "#000",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          )}
        </div>

        {/* Kontrolki */}
        <div
          style={{
            padding: "20px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            justifyContent: "center",
            gap: "15px",
            alignItems: "center",
            position: "relative",
          }}
        >
          {/* Ustawienia urządzeń */}
          <button
            onClick={() => setShowDeviceSettings(!showDeviceSettings)}
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              backgroundColor: showDeviceSettings
                ? "rgba(255, 255, 255, 0.4)"
                : "rgba(255, 255, 255, 0.2)",
              color: "#fff",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Ustawienia urządzeń"
          >
            ⚙️
          </button>

          {/* Przełącznik kamery */}
          {callType === "video" && (
            <button
              onClick={toggleVideo}
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "50%",
                backgroundColor: isVideoMuted
                  ? "rgba(220, 53, 69, 0.8)"
                  : "rgba(255, 255, 255, 0.2)",
                color: "#fff",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
              title={isVideoMuted ? "Włącz kamerę" : "Wyłącz kamerę"}
            >
              {isVideoMuted ? (
                <span style={{ position: "relative" }}>
                  📹
                  <span
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%) rotate(-45deg)",
                      fontSize: "28px",
                      color: "#fff",
                    }}
                  >
                    /
                  </span>
                </span>
              ) : (
                "📹"
              )}
            </button>
          )}

          {/* Przełącznik mikrofonu */}
          <button
            onClick={toggleMute}
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              backgroundColor: isAudioMuted
                ? "rgba(220, 53, 69, 0.8)"
                : "rgba(255, 255, 255, 0.2)",
              color: "#fff",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
            title={isAudioMuted ? "Włącz mikrofon" : "Wycisz mikrofon"}
          >
            {isAudioMuted ? (
              <span style={{ position: "relative" }}>
                🎤
                <span
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%) rotate(-45deg)",
                    fontSize: "28px",
                    color: "#fff",
                  }}
                >
                  /
                </span>
              </span>
            ) : (
              <>
                🎤
                {audioLevel > 5 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-3px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "80%",
                      height: "3px",
                      backgroundColor: "#4CAF50",
                      borderRadius: "2px",
                      opacity: Math.min(1, audioLevel / 50),
                    }}
                  />
                )}
              </>
            )}
          </button>

          {/* Zakończ połączenie */}
          <button
            onClick={endCall}
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: ui.danger,
              color: ui.dangerText,
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
            title="Zakończ połączenie"
          >
            📞
          </button>

          {/* Panel ustawień urządzeń */}
          {showDeviceSettings && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                marginBottom: "10px",
                backgroundColor: "rgba(0, 0, 0, 0.9)",
                borderRadius: "10px",
                padding: "15px",
                minWidth: "300px",
                maxWidth: "400px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                color: "#fff",
              }}
            >
              <h4 style={{ margin: "0 0 15px 0", fontSize: "16px" }}>
                Ustawienia urządzeń
              </h4>

              {/* Wybór mikrofonu */}
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "14px",
                    color: "#ccc",
                  }}
                >
                  🎤 Mikrofon
                </label>
                <select
                  value={selectedAudioDevice || ""}
                  onChange={(e) => changeAudioDevice?.(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    borderRadius: "5px",
                    color: "#fff",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label ||
                        `Mikrofon ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Wybór kamery */}
              {callType === "video" && (
                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontSize: "14px",
                      color: "#ccc",
                    }}
                  >
                    📹 Kamera
                  </label>
                  <select
                    value={selectedVideoDevice || ""}
                    onChange={(e) => changeVideoDevice?.(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "5px",
                      color: "#fff",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  >
                    {videoDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Kamera ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Wybór głośników */}
              {outputDevices.length > 0 && (
                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontSize: "14px",
                      color: "#ccc",
                    }}
                  >
                    🔊 Głośniki
                  </label>
                  <select
                    value={selectedOutputDevice || ""}
                    onChange={(e) => changeOutputDevice?.(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "5px",
                      color: "#fff",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  >
                    {outputDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Głośniki ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status */}
              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.2)",
                  fontSize: "12px",
                  color: "#999",
                }}
              >
                <div
                  style={{
                    marginBottom: "5px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    Mikrofon: {isAudioMuted ? "🔇 Wyciszony" : "🔊 Aktywny"}
                  </span>
                  {!isAudioMuted && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <div
                        style={{
                          width: "50px",
                          height: "4px",
                          backgroundColor: "rgba(255, 255, 255, 0.2)",
                          borderRadius: "2px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${audioLevel}%`,
                            height: "100%",
                            backgroundColor:
                              audioLevel > 50 ? "#4CAF50" : "#FFC107",
                            transition: "width 0.1s ease",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {callType === "video" && (
                  <div>
                    Kamera: {isVideoMuted ? "📹 Wyłączona" : "📹 Aktywna"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            padding: "8px 16px",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            borderRadius: "20px",
            color: "#fff",
            fontSize: "14px",
          }}
        >
          {callState === "connected"
            ? "🟢 Połączono"
            : callState === "connecting"
              ? "🟡 Łączenie..."
              : "⏳"}
        </div>

        {/* Network Quality Indicator */}
        {callState === "connected" && (
          <div
            style={{
              position: "absolute",
              top: "60px",
              left: "20px",
              padding: "6px 12px",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              borderRadius: "15px",
              color: "#fff",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            {networkQuality === "good" && "📶 Doskonała jakość"}
            {networkQuality === "medium" && "📶 Średnia jakość"}
            {networkQuality === "poor" && "⚠️ Słaba jakość"}
            {connectionStats && connectionStats.packetLossRate > 0 && (
              <span style={{ fontSize: "10px", opacity: 0.7 }}>
                ({connectionStats.packetLossRate.toFixed(1)}% utrata)
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Fallback - nie powinno się tu dostać
  return null;
};

export default VideoCall;
