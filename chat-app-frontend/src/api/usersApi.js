import axiosInstance from './axios'

export const usersApi = {
    getNotificationSettings: async () => {
        const response = await axiosInstance.get('/users/notification-settings')
        return response.data
    },
    updateNotificationSettings: async settings => {
        const response = await axiosInstance.put('/users/notification-settings', settings)
        return response.data
    },

    // Domyślny czas znikania wiadomości
    getDefaultDisappearingTime: async () => {
        const response = await axiosInstance.get('/users/default-disappearing-time')
        return response.data
    },

    updateDefaultDisappearingTime: async timeInSeconds => {
        const response = await axiosInstance.put('/users/default-disappearing-time', { timeInSeconds })
        return response.data
    },
}


