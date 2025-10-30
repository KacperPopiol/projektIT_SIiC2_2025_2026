export const notificationUtils = {
    isSupported: () => {
        return 'Notification' in window
    },
    getPermission: () => {
        if (!notificationUtils.isSupported()) return 'unsupported'
        return Notification.permission
    },
    requestPermission: async () => {
        if (!notificationUtils.isSupported()) {
            return 'unsupported'
        }
        const permission = await Notification.requestPermission()
        return permission
    },
    show: (title, options = {}) => {
        if (!notificationUtils.isSupported()) return null
        if (Notification.permission !== 'granted') return null

        const notification = new Notification(title, {
            icon: '/vite.svg',
            badge: '/vite.svg',
            ...options,
        })

        return notification
    },
    isPageHidden: () => {
        return document.hidden
    },
}


