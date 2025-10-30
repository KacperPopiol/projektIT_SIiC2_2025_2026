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
}


