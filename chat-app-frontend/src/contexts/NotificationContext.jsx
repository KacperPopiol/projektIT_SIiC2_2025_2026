import { createContext, useState, useEffect, useContext } from 'react'
import { notificationUtils } from '../utils/notifications'
import { usersApi } from '../api/usersApi'
import { storage } from '../utils/storage'
import { AuthContext } from './AuthContext'
import { SocketContext } from './SocketContext'

export const NotificationContext = createContext()

export const NotificationProvider = ({ children }) => {
    const [permission, setPermission] = useState(notificationUtils.getPermission())
    const [settings, setSettings] = useState(null)
    const { isAuthenticated } = useContext(AuthContext)
    const { socket, connected } = useContext(SocketContext)

    useEffect(() => {
        if (isAuthenticated) {
            loadSettings()
        }
    }, [isAuthenticated])

    useEffect(() => {
        if (!socket || !connected || !settings) return

        const handlePrivateMessage = data => {
            if (settings.notifications_enabled && settings.notify_private_messages) {
                showNotification(data, 'private')
            }
        }

        const handleGroupMessage = data => {
            if (settings.notifications_enabled && settings.notify_group_messages) {
                showNotification(data, 'group')
            }
        }

        socket.on('new_private_message', handlePrivateMessage)
        socket.on('new_group_message', handleGroupMessage)

        return () => {
            socket.off('new_private_message', handlePrivateMessage)
            socket.off('new_group_message', handleGroupMessage)
        }
    }, [socket, connected, settings])

    const loadSettings = async () => {
        try {
            const response = await usersApi.getNotificationSettings()
            setSettings(response.settings)
            storage.setNotificationSettings(response.settings)
        } catch (error) {
            console.error('Błąd ładowania ustawień powiadomień:', error)
        }
    }

    const updateSettings = async newSettings => {
        try {
            await usersApi.updateNotificationSettings(newSettings)
            setSettings(newSettings)
            storage.setNotificationSettings(newSettings)
        } catch (error) {
            console.error('Błąd aktualizacji ustawień:', error)
            throw error
        }
    }

    const requestPermission = async () => {
        const result = await notificationUtils.requestPermission()
        setPermission(result)
        return result
    }

    const showNotification = (messageData, type) => {
        if (!notificationUtils.isPageHidden()) return

        const title = type === 'private' ? 'Nowa wiadomość prywatna' : 'Nowa wiadomość w grupie'

        const notification = notificationUtils.show(title, {
            body: 'Masz nową wiadomość. Otwórz aplikację, aby ją przeczytać.',
            data: {
                conversationId: messageData.conversationId,
                type: type,
                groupId: messageData.groupId,
            },
        })

        if (notification) {
            notification.onclick = () => {
                window.focus()
                const params = new URLSearchParams()
                params.set('c', messageData.conversationId)
                params.set('t', type)
                if (messageData.groupId) params.set('g', messageData.groupId)
                window.location.href = `/chat?${params.toString()}`
                notification.close()
            }
        }
    }

    const value = { permission, settings, requestPermission, updateSettings, loadSettings }

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}


