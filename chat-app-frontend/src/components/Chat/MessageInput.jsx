import { useState, useRef, useEffect } from 'react'
import { useSocket } from '../../hooks/useSocket'

const MessageInput = ({ conversation, onMessageSent }) => {
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const { socket, connected } = useSocket()
    const typingTimeoutRef = useRef(null)

    // ✅ OBSŁUGA BŁĘDÓW Z BACKENDU
    useEffect(() => {
        if (!socket) return

        const handleError = (errorData) => {
            console.error('Socket error:', errorData)
            
            if (errorData.code === 'NOT_FRIENDS') {
                alert(
                    '⚠️ Nie możesz wysłać wiadomości\n\n' +
                    'Ta osoba nie jest już Twoim znajomym.\n' +
                    'Dodaj ją ponownie w zakładce "👥 Znajomi" aby móc pisać.'
                )
            } else if (errorData.code === 'INVALID_DATA') {
                alert('Błąd: Nieprawidłowe dane wiadomości')
            } else if (errorData.code === 'NOT_FOUND') {
                alert('Błąd: Konwersacja nie została znaleziona')
            } else if (errorData.code === 'RECIPIENT_NOT_FOUND') {
                alert('Błąd: Odbiorca nie został znaleziony')
            } else {
                alert('Błąd wysyłania: ' + (errorData.message || 'Nieznany błąd'))
            }
            
            setSending(false)
        }

        const handleMessageSent = (data) => {
            console.log('✅ Wiadomość wysłana:', data)
            setSending(false)
        }

        socket.on('error', handleError)
        socket.on('message_sent', handleMessageSent)

        return () => {
            socket.off('error', handleError)
            socket.off('message_sent', handleMessageSent)
        }
    }, [socket])

    const handleTyping = () => {
        if (!connected || !socket) return

        // Wyślij event "typing"
        socket.emit('typing', {
            conversationId: conversation.conversationId,
            isGroup: conversation.type === 'group',
            groupId: conversation.groupId || null,
        })

        // Wyczyść poprzedni timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }

        // Wyślij "stop_typing" po 2 sekundach bezczynności
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stop_typing', {
                conversationId: conversation.conversationId,
                isGroup: conversation.type === 'group',
                groupId: conversation.groupId || null,
            })
        }, 2000)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!message.trim() || !connected || sending) return

        setSending(true)

        try {
            // Wyślij "stop_typing" przed wysłaniem wiadomości
            socket.emit('stop_typing', {
                conversationId: conversation.conversationId,
                isGroup: conversation.type === 'group',
                groupId: conversation.groupId || null,
            })

            // Wyczyść timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }

            // ✅ Wysyłanie przez Socket.io
            if (conversation.type === 'private') {
                socket.emit('send_private_message', {
                    conversationId: conversation.conversationId,
                    content: message.trim(),
                })
            } else {
                socket.emit('send_group_message', {
                    conversationId: conversation.conversationId,
                    groupId: conversation.groupId,
                    content: message.trim(),
                })
            }

            // ✅ Wyczyść message TYLKO po potwierdzeniu wysłania
            // (setSending(false) i setMessage('') będą obsłużone w listenerze 'message_sent')
            setMessage('')

            // Timeout zabezpieczający (jeśli backend nie odpowie)
            setTimeout(() => {
                if (sending) {
                    console.warn('⚠️ Brak odpowiedzi z backendu - reset sending')
                    setSending(false)
                }
            }, 5000)

        } catch (error) {
            console.error('❌ Błąd wysyłania wiadomości:', error)
            alert('Nie udało się wysłać wiadomości')
            setSending(false)
        }
    }

    const handleChange = (e) => {
        setMessage(e.target.value)
        handleTyping()
    }

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                padding: '15px',
                borderTop: '1px solid #ddd',
                backgroundColor: '#fff',
                display: 'flex',
                gap: '10px',
            }}>
            <input
                type='text'
                value={message}
                onChange={handleChange}
                placeholder={connected ? 'Wpisz wiadomość...' : 'Łączenie...'}
                disabled={!connected || sending}
                style={{
                    flex: 1,
                    padding: '10px 15px',
                    borderRadius: '20px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: sending ? '#f5f5f5' : 'white',
                    cursor: sending ? 'not-allowed' : 'text',
                }}
            />
            <button
                type='submit'
                disabled={!message.trim() || !connected || sending}
                style={{
                    padding: '10px 25px',
                    backgroundColor: !message.trim() || !connected || sending ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: !message.trim() || !connected || sending ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s',
                }}>
                {sending ? '⏳ Wysyłanie...' : '📤 Wyślij'}
            </button>
        </form>
    )
}

export default MessageInput
