import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import { messagesApi } from "../api/messagesApi";
import ChatWindow from "../components/Chat/ChatWindow";
import { notificationUtils } from "../utils/notifications";
import { useNotifications } from "../hooks/useNotifications";

const ChatPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { socket, connected } = useSocket();
  const [activeTab, setActiveTab] = useState("active"); // 'active' lub 'archived'
  const [archivedConversations, setArchivedConversations] = useState({
    privateConversations: [],
    groupConversations: [],
  });
  const [conversations, setConversations] = useState({
    privateConversations: [],
    groupConversations: [],
  });
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const { requestPermission } = useNotifications();

  const ui = {
    bg: "var(--color-bg)",
    surface: "var(--color-surface)",
    elevated: "var(--color-elevated)",
    border: "var(--color-border)",
    borderStrong: "var(--color-border-strong)",
    textPrimary: "var(--color-text-primary)",
    textSecondary: "var(--color-text-secondary)",
    textMuted: "var(--color-text-muted)",
    link: "var(--color-link)",
    accent: "var(--color-accent)",
    accentHover: "var(--button-primary-hover)",
    accentText: "var(--button-primary-text)",
    secondary: "var(--color-secondary)",
    secondaryText: "var(--color-secondary-contrast)",
    secondaryHover: "var(--button-secondary-hover)",
    success: "var(--button-success-bg)",
    successHover: "var(--button-success-hover)",
    successText: "var(--button-success-text)",
    successSoft: "var(--color-success-soft)",
    danger: "var(--button-danger-bg)",
    dangerText: "var(--button-danger-text)",
    dangerHover: "var(--button-danger-hover)",
    warning: "var(--color-warning)",
    info: "var(--color-info)",
    infoText: "var(--color-info-contrast)",
    cardShadow: "var(--shadow-sm)",
    scrollTrack: "var(--scrollbar-track)",
    mutedSurface: "var(--card-bg)",
    mutedBorder: "var(--color-border)",
    emptyIcon: "var(--color-text-muted)",
  };

  const getConversationCardStyles = (isSelected) => ({
    padding: "12px",
    marginBottom: "8px",
    backgroundColor: isSelected ? ui.accent : ui.surface,
    color: isSelected ? ui.accentText : ui.textPrimary,
    borderRadius: "8px",
    cursor: "pointer",
    border: isSelected
      ? `2px solid ${ui.accentHover}`
      : `1px solid ${ui.border}`,
    boxShadow: isSelected ? ui.cardShadow : "none",
    transition: "all 0.2s ease",
  });

  const getParticipantAvatarStyle = (isSelected, hasAvatar) => ({
    width: "35px",
    height: "35px",
    borderRadius: "50%",
    backgroundColor: hasAvatar
      ? "transparent"
      : isSelected
        ? ui.surface
        : ui.accent,
    color: isSelected ? ui.accent : ui.accentText,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "bold",
    backgroundSize: "cover",
    backgroundPosition: "center",
    border: isSelected
      ? `2px solid ${ui.accentHover}`
      : `2px solid ${ui.border}`,
    flexShrink: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  // Prompt o uprawnienia przy pierwszym wejściu
  useEffect(() => {
    const ask = async () => {
      if (notificationUtils.getPermission() === "default") {
        const shouldAsk = confirm(
          "Czy chcesz otrzymywać powiadomienia o nowych wiadomościach?",
        );
        if (shouldAsk) {
          await requestPermission();
        }
      }
    };
    ask();
  }, []);

  // Deep-link do konwersacji z query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("c");
    const type = params.get("t");
    const groupId = params.get("g");
    if (convId && type) {
      setSelectedConversation({
        id: type === "group" ? Number(groupId) : Number(convId),
        type,
        name: type === "group" ? "Grupa" : "Rozmowa",
        conversationId: Number(convId),
        groupId: groupId ? Number(groupId) : undefined,
      });
      // wyczyść query po ustawieniu
      window.history.replaceState(null, "", "/chat");
    }
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;

    const handleNewMessage = () => {
      console.log("📨 New message received, refreshing conversations...");
      loadData();
    };

    socket.on("new_private_message", handleNewMessage);
    socket.on("new_group_message", handleNewMessage);

    return () => {
      socket.off("new_private_message", handleNewMessage);
      socket.off("new_group_message", handleNewMessage);
    };
  }, [socket, connected]);

  const loadData = async () => {
    // 	try {
    // 		console.log('📡 Loading chat data...')

    // 		const conversationsRes = await messagesApi.getConversations().catch(err => {
    // 			console.error('❌ Conversations error:', err.response?.data || err.message)
    // 			return { privateConversations: [], groupConversations: [] }
    // 		})

    // 		console.log('📋 Conversations loaded:', {
    // 			private: conversationsRes.privateConversations?.length || 0,
    // 			group: conversationsRes.groupConversations?.length || 0,
    // 		})

    // 		setConversations(conversationsRes || { privateConversations: [], groupConversations: [] })
    // 	} catch (error) {
    // 		console.error('❌ Error loading data:', error)
    // 		setConversations({ privateConversations: [], groupConversations: [] })
    // 	} finally {
    // 		console.log('✅ Loading complete')
    // 		setLoading(false)
    // 	}
    // }

    try {
      console.log("📡 Loading chat data...");

      // Ładuj aktywne konwersacje
      const activeConversationsRes = await messagesApi
        .getConversations(false)
        .catch((err) => {
          console.error(
            "❌ Conversations error:",
            err.response?.data || err.message,
          );
          return { privateConversations: [], groupConversations: [] };
        });

      // Ładuj zarchiwizowane konwersacje
      const archivedConversationsRes = await messagesApi
        .getConversations(true)
        .catch((err) => {
          console.error(
            "❌ Archived conversations error:",
            err.response?.data || err.message,
          );
          return { privateConversations: [], groupConversations: [] };
        });

      console.log("📋 Active conversations loaded:", {
        private: activeConversationsRes.privateConversations?.length || 0,
        group: activeConversationsRes.groupConversations?.length || 0,
      });

      console.log("📦 Archived conversations loaded:", {
        private:
          archivedConversationsRes.privateConversations?.filter(
            (c) => c.is_archived,
          ).length || 0,
        group:
          archivedConversationsRes.groupConversations?.filter(
            (gm) => gm.is_archived,
          ).length || 0,
      });

      setConversations(
        activeConversationsRes || {
          privateConversations: [],
          groupConversations: [],
        },
      );
      setArchivedConversations(
        archivedConversationsRes || {
          privateConversations: [],
          groupConversations: [],
        },
      );
    } catch (error) {
      console.error("❌ Error loading data:", error);
      setConversations({ privateConversations: [], groupConversations: [] });
      setArchivedConversations({
        privateConversations: [],
        groupConversations: [],
      });
    } finally {
      console.log("✅ Loading complete");
      setLoading(false);
    }
  };

  // const getUnreadCount = conversation => {
  // 	if (!conversation?.messages) return 0

  // 	return conversation.messages.filter(msg => {
  // 		// Sprawdź czy wiadomość nie jest nasza
  // 		if (msg.sender_id === user?.userId) return false

  // 		// Sprawdź czy jest przeczytana przez nas
  // 		const isRead = msg.readStatuses?.some(status => status.user_id === user?.userId && status.is_read)

  // 		return !isRead
  // 	}).length
  // }

  const getUnreadCount = (conversation) => {
    if (!conversation?.messages || !user) return 0;

    return conversation.messages.filter((msg) => {
      // Sprawdź czy wiadomość NIE jest nasza
      if (msg.sender_id === user.userId) return false;

      // Sprawdź czy mamy status odczytania
      if (!msg.readStatuses || msg.readStatuses.length === 0) {
        // Brak statusów = nowa wiadomość = nieprzeczytana
        return true;
      }

      // Sprawdź czy JA przeczytałem tę wiadomość
      const myReadStatus = msg.readStatuses.find(
        (status) => status.user_id === user.userId,
      );

      // Jeśli nie ma mojego statusu LUB status = false
      return !myReadStatus || !myReadStatus.is_read;
    }).length;
  };

  // Jeśli ładowanie, pokaż spinner
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "15px",
          backgroundColor: ui.bg,
          color: ui.textPrimary,
        }}
      >
        <div
          style={{
            width: "50px",
            height: "50px",
            border: `5px solid ${ui.scrollTrack}`,
            borderTop: `5px solid ${ui.accent}`,
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <h2>Ładowanie aplikacji...</h2>
        <p style={{ color: ui.textMuted }}>
          Socket.io: {connected ? "🟢 Połączono" : "🔴 Łączenie..."}
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  const handleUnarchive = async (conversationId) => {
    try {
      await messagesApi.unarchiveConversation(conversationId);
      alert("Konwersacja przywrócona z archiwum!");
      await loadData(); // Odśwież dane
    } catch (err) {
      alert("Błąd przywracania: " + (err.response?.data?.error || err.message));
    }
  };
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: ui.bg,
        color: ui.textPrimary,
      }}
    >
      {/* Sidebar - Lista konwersacji */}
      <div
        style={{
          width: "320px",
          borderRight: `1px solid ${ui.border}`,
          backgroundColor: ui.bg,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px",
            borderBottom: `2px solid ${ui.border}`,
            backgroundColor: ui.surface,
            boxShadow: ui.cardShadow,
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", fontSize: "20px" }}>
            💬 Chat App
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            {/* Avatar - POPRAWIONY */}
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: user?.avatarUrl ? "transparent" : ui.accent,
                color: user?.avatarUrl ? ui.textPrimary : ui.accentText,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "bold",
                backgroundImage: user?.avatarUrl
                  ? `url(${user.avatarUrl})`
                  : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: `2px solid ${ui.border}`,
              }}
            >
              {!user?.avatarUrl && user?.username?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                {user?.username}
              </div>
              <div style={{ fontSize: "12px", color: ui.textMuted }}>
                {connected ? "🟢 Online" : "🔴 Offline"}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              width: "100%",
              padding: "8px",
              backgroundColor: ui.danger,
              color: ui.dangerText,
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "bold",
            }}
          >
            🚪 Wyloguj się
          </button>
          <button
            onClick={() => navigate("/profile")}
            style={{
              marginTop: "5px",
              width: "100%",
              padding: "5px 15px",
              backgroundColor: ui.info,
              color: ui.infoText,
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            ⚙️ Profil
          </button>
        </div>

        <div
          style={{
            display: "flex",
            borderBottom: `2px solid ${ui.border}`,
            backgroundColor: ui.surface,
          }}
        >
          <button
            onClick={() => setActiveTab("active")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              backgroundColor:
                activeTab === "active" ? ui.accent : "transparent",
              color: activeTab === "active" ? ui.accentText : ui.textMuted,
              cursor: "pointer",
              fontWeight: activeTab === "active" ? "bold" : "normal",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
          >
            💬 Aktywne
          </button>
          <button
            onClick={() => setActiveTab("archived")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              backgroundColor:
                activeTab === "archived" ? ui.accent : "transparent",
              color: activeTab === "archived" ? ui.accentText : ui.textMuted,
              cursor: "pointer",
              fontWeight: activeTab === "archived" ? "bold" : "normal",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
          >
            📦 Archiwum (
            {archivedConversations.privateConversations?.filter(
              (c) => c.is_archived,
            ).length || 0}
            )
          </button>
        </div>

        {/* Lista konwersacji - warunkowe renderowanie */}
        <div style={{ padding: "15px", flex: 1, overflowY: "auto" }}>
          {activeTab === "active" ? (
            <>
              {/* AKTYWNE - Konwersacje prywatne */}
              <h4
                style={{
                  fontSize: "13px",
                  color: ui.textMuted,
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                💬 Konwersacje Prywatne
              </h4>
              {!conversations.privateConversations ||
              conversations.privateConversations.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    backgroundColor: ui.surface,
                    borderRadius: "8px",
                    border: `1px dashed ${ui.border}`,
                  }}
                >
                  <p
                    style={{ fontSize: "12px", color: ui.textMuted, margin: 0 }}
                  >
                    Brak aktywnych konwersacji
                  </p>
                </div>
              ) : (
                conversations.privateConversations.map((conv) => {
                  const otherUser = conv.conversation?.participants?.[0]?.user;
                  const lastMessage = "";
                  const isSelected =
                    selectedConversation?.id === conv.conversation_id;

                  return (
                    <div
                      key={conv.conversation_id}
                      onClick={() =>
                        setSelectedConversation({
                          id: conv.conversation_id,
                          type: "private",
                          name: otherUser?.username || "Użytkownik",
                          conversationId: conv.conversation_id,
                        })
                      }
                      style={{
                        padding: "12px",
                        marginBottom: "8px",
                        backgroundColor: isSelected ? ui.accent : ui.surface,
                        color: isSelected ? ui.accentText : ui.textPrimary,
                        borderRadius: "8px",
                        cursor: "pointer",
                        border: isSelected
                          ? `2px solid ${ui.accentHover}`
                          : `1px solid ${ui.border}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            width: "35px",
                            height: "35px",
                            borderRadius: "50%",
                            backgroundColor: otherUser?.avatar_url
                              ? "transparent"
                              : isSelected
                                ? ui.surface
                                : ui.accent,
                            color: isSelected ? ui.accent : ui.accentText,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            fontWeight: "bold",
                            backgroundImage: otherUser?.avatar_url
                              ? `url(${otherUser.avatar_url})`
                              : "none",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            border: isSelected
                              ? `2px solid ${ui.accentHover}`
                              : `2px solid ${ui.border}`,
                          }}
                        >
                          {!otherUser?.avatar_url &&
                            (otherUser?.username?.charAt(0).toUpperCase() ||
                              "?")}
                        </div>
                        {/* <div style={{ flex: 1, minWidth: 0 }}>
													<div style={{ fontWeight: 'bold', fontSize: '14px' }}>
														{otherUser?.username || 'Użytkownik'}
													</div>
													{lastMessage && (
														<div
															style={{
																fontSize: '12px',
																opacity: 0.8,
																marginTop: '3px',
																overflow: 'hidden',
																textOverflow: 'ellipsis',
																whiteSpace: 'nowrap',
															}}>
															{lastMessage.content}
														</div>
													)}
												</div> */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: "bold",
                              fontSize: "14px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span>{otherUser?.username || "Użytkownik"}</span>
                            {(() => {
                              const unreadCount = getUnreadCount(
                                conv.conversation,
                              );
                              return unreadCount > 0 ? (
                                <span
                                  style={{
                                    backgroundColor: ui.danger,
                                    color: ui.dangerText,
                                    fontSize: "11px",
                                    fontWeight: "bold",
                                    padding: "2px 6px",
                                    borderRadius: "10px",
                                    minWidth: "20px",
                                    textAlign: "center",
                                  }}
                                >
                                  {unreadCount}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          {lastMessage && (
                            <div
                              style={{
                                fontSize: "12px",
                                opacity: 0.8,
                                marginTop: "3px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lastMessage.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* AKTYWNE - Grupy */}
              <h4
                style={{
                  fontSize: "13px",
                  color: ui.textMuted,
                  marginTop: "25px",
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                👥 Grupy
              </h4>
              {!conversations.groupConversations ||
              conversations.groupConversations.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    backgroundColor: ui.surface,
                    borderRadius: "8px",
                    border: `1px dashed ${ui.border}`,
                  }}
                >
                  <p
                    style={{ fontSize: "12px", color: ui.textMuted, margin: 0 }}
                  >
                    Brak grup
                  </p>
                </div>
              ) : (
                conversations.groupConversations.map((groupMember) => {
                  const group = groupMember.group;
                  const lastMessage = "";
                  const isSelected =
                    selectedConversation?.id === group?.group_id;

                  return (
                    <div
                      key={group?.group_id}
                      onClick={() =>
                        setSelectedConversation({
                          id: group?.group_id,
                          type: "group",
                          name: group?.group_name || "Grupa",
                          conversationId: group?.conversation?.conversation_id,
                          groupId: group?.group_id,
                        })
                      }
                      style={{
                        padding: "12px",
                        marginBottom: "8px",
                        backgroundColor: isSelected ? ui.success : ui.surface,
                        color: isSelected ? ui.successText : ui.textPrimary,
                        borderRadius: "8px",
                        cursor: "pointer",
                        border: isSelected
                          ? `2px solid ${ui.successSoft}`
                          : `1px solid ${ui.border}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            width: "35px",
                            height: "35px",
                            borderRadius: "50%",
                            backgroundColor: isSelected
                              ? ui.surface
                              : ui.success,
                            color: isSelected ? ui.success : ui.successText,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                          }}
                        >
                          👥
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                            {group?.group_name || "Grupa"}
                          </div>
                          {lastMessage && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: ui.textMuted,
                                marginTop: "3px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lastMessage.sender?.username}:{" "}
                              {lastMessage.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <>
              {/* ARCHIWUM - Konwersacje Prywatne */}
              <h4
                style={{
                  fontSize: "13px",
                  color: ui.textMuted,
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                📦 Zarchiwizowane Konwersacje Prywatne
              </h4>
              {!archivedConversations.privateConversations ||
              archivedConversations.privateConversations.filter(
                (c) => c.is_archived,
              ).length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    backgroundColor: ui.surface,
                    borderRadius: "8px",
                    border: `1px dashed ${ui.border}`,
                  }}
                >
                  <p
                    style={{ fontSize: "12px", color: ui.textMuted, margin: 0 }}
                  >
                    Brak zarchiwizowanych konwersacji prywatnych
                  </p>
                </div>
              ) : (
                archivedConversations.privateConversations
                  .filter((c) => c.is_archived)
                  .map((conv) => {
                    const otherUser =
                      conv.conversation?.participants?.[0]?.user;
                    const lastMessage = conv.conversation?.messages?.[0];

                    return (
                      <div
                        key={conv.conversation_id}
                        style={{
                          padding: "12px",
                          marginBottom: "8px",
                          backgroundColor: ui.surface,
                          borderRadius: "8px",
                          border: `1px solid ${ui.border}`,
                          boxShadow: ui.cardShadow,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              width: "35px",
                              height: "35px",
                              borderRadius: "50%",
                              backgroundColor: ui.secondary,
                              color: ui.secondaryText,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "14px",
                              fontWeight: "bold",
                            }}
                          >
                            {otherUser?.username?.charAt(0).toUpperCase() ||
                              "?"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "14px",
                                color: ui.textPrimary,
                              }}
                            >
                              {otherUser?.username || "Użytkownik"}
                            </div>
                            {lastMessage && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: ui.textMuted,
                                  marginTop: "3px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {lastMessage.content}
                              </div>
                            )}
                            <div
                              style={{
                                fontSize: "11px",
                                color: ui.textMuted,
                                marginTop: "5px",
                              }}
                            >
                              Zarchiwizowano:{" "}
                              {new Date(conv.archived_at).toLocaleDateString(
                                "pl-PL",
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleUnarchive(conv.conversation_id)
                            }
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                ui.successHover)
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                ui.success)
                            }
                            style={{
                              padding: "6px 12px",
                              backgroundColor: ui.success,
                              color: ui.successText,
                              border: "none",
                              borderRadius: "5px",
                              cursor: "pointer",
                              fontSize: "12px",
                              transition: "background-color 0.2s ease",
                            }}
                          >
                            Przywróć
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}

              {/* ARCHIWUM - Grupy */}
              <h4
                style={{
                  fontSize: "13px",
                  color: ui.textMuted,
                  marginTop: "25px",
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                👥 Zarchiwizowane Grupy
              </h4>
              {!archivedConversations.groupConversations ||
              archivedConversations.groupConversations.filter(
                (gm) => gm.is_archived,
              ).length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    backgroundColor: ui.surface,
                    borderRadius: "8px",
                    border: `1px dashed ${ui.border}`,
                  }}
                >
                  <p
                    style={{ fontSize: "12px", color: ui.textMuted, margin: 0 }}
                  >
                    Brak zarchiwizowanych grup
                  </p>
                </div>
              ) : (
                archivedConversations.groupConversations
                  .filter((gm) => gm.is_archived)
                  .map((groupMember) => {
                    const group = groupMember.group;
                    const lastMessage = group?.conversation?.messages?.[0];
                    const archivedAt = groupMember.archived_at;

                    return (
                      <div
                        key={group?.group_id}
                        style={{
                          padding: "12px",
                          marginBottom: "8px",
                          backgroundColor: ui.surface,
                          borderRadius: "8px",
                          border: `1px solid ${ui.border}`,
                          boxShadow: ui.cardShadow,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              width: "35px",
                              height: "35px",
                              borderRadius: "50%",
                              backgroundColor: ui.secondary,
                              color: ui.secondaryText,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "16px",
                            }}
                          >
                            👥
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "14px",
                                color: ui.textPrimary,
                              }}
                            >
                              {group?.group_name || "Grupa"}
                            </div>
                            {lastMessage && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: ui.textMuted,
                                  marginTop: "3px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {lastMessage.sender?.username}:{" "}
                                {lastMessage.content}
                              </div>
                            )}
                            <div
                              style={{
                                fontSize: "11px",
                                color: ui.textMuted,
                                marginTop: "5px",
                              }}
                            >
                              Zarchiwizowano:{" "}
                              {new Date(archivedAt).toLocaleDateString("pl-PL")}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleUnarchive(
                                group?.conversation?.conversation_id,
                              )
                            }
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                ui.successHover)
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                ui.success)
                            }
                            style={{
                              padding: "6px 12px",
                              backgroundColor: ui.success,
                              color: ui.successText,
                              border: "none",
                              borderRadius: "5px",
                              cursor: "pointer",
                              fontSize: "12px",
                              transition: "background-color 0.2s ease",
                            }}
                          >
                            Przywróć
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </>
          )}
        </div>

        {/* Przyciski zarządzania - na dole */}
        <div
          style={{
            padding: "15px",
            borderTop: `1px solid ${ui.border}`,
            backgroundColor: ui.surface,
            boxShadow: ui.cardShadow,
          }}
        >
          <button
            onClick={() => navigate("/contacts")}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = ui.accentHover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = ui.accent)
            }
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "8px",
              backgroundColor: ui.accent,
              color: ui.accentText,
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              transition: "background-color 0.2s",
            }}
          >
            👥 Zarządzaj Znajomymi
          </button>
          <button
            onClick={() => navigate("/groups")}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = ui.successHover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = ui.success)
            }
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: ui.success,
              color: ui.successText,
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              transition: "background-color 0.2s",
            }}
          >
            🎯 Zarządzaj Grupami
          </button>
        </div>
      </div>

      {/* Chat Window */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedConversation ? (
          <ChatWindow conversation={selectedConversation} />
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              color: ui.textMuted,
              backgroundColor: ui.bg,
            }}
          >
            <div
              style={{
                textAlign: "center",
                maxWidth: "400px",
                padding: "20px",
              }}
            >
              <div style={{ fontSize: "64px", marginBottom: "20px" }}>💬</div>
              <h2 style={{ color: ui.textPrimary, marginBottom: "10px" }}>
                Wybierz konwersację
              </h2>
              <p style={{ color: ui.textSecondary, marginBottom: "30px" }}>
                Kliknij na konwersację po lewej stronie aby rozpocząć czat
              </p>
              <div
                style={{
                  padding: "20px",
                  backgroundColor: ui.surface,
                  borderRadius: "10px",
                  border: `1px solid ${ui.border}`,
                  boxShadow: ui.cardShadow,
                }}
              >
                <p
                  style={{
                    fontSize: "14px",
                    color: ui.textSecondary,
                    margin: "0 0 15px 0",
                  }}
                >
                  <strong>Pierwsze kroki:</strong>
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: ui.textMuted,
                    margin: "5px 0",
                  }}
                >
                  1. Kliknij "👥 Zarządzaj Znajomymi"
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: ui.textMuted,
                    margin: "5px 0",
                  }}
                >
                  2. Wygeneruj kod zaproszeniowy
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: ui.textMuted,
                    margin: "5px 0",
                  }}
                >
                  3. Podziel się kodem z innymi
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: ui.textMuted,
                    margin: "5px 0",
                  }}
                >
                  4. Zaakceptuj zaproszenia
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
