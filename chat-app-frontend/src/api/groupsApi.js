import axiosInstance from './axios'

export const groupsApi = {
	// Tworzenie grupy
	createGroup: async groupName => {
		const response = await axiosInstance.post('/groups', {
			groupName,
		})
		return response.data
	},

	// Lista moich grup
	getMyGroups: async () => {
		const response = await axiosInstance.get('/groups/my-groups')
		return response.data
	},

	// Generowanie kodu zaproszeniowego do grupy
	generateGroupInvite: async groupId => {
		const response = await axiosInstance.post(`/groups/${groupId}/generate-invite`)
		return response.data
	},

	// Prośba o dołączenie do grupy
	requestJoinGroup: async inviteCode => {
		const response = await axiosInstance.post('/groups/join', {
			inviteCode,
		})
		return response.data
	},

	// Lista oczekujących próśb
	getPendingRequests: async groupId => {
		const response = await axiosInstance.get(`/groups/${groupId}/pending`)
		return response.data
	},

	// Zatwierdzenie członka
	acceptMember: async (groupId, memberId) => {
		const response = await axiosInstance.post(`/groups/${groupId}/members/${memberId}/accept`)
		return response.data
	},

	// Odrzucenie członka
	rejectMember: async (groupId, memberId) => {
		const response = await axiosInstance.delete(`/groups/${groupId}/members/${memberId}/reject`)
		return response.data
	},

	// Usunięcie członka
	removeMember: async (groupId, memberId) => {
		const response = await axiosInstance.delete(`/groups/${groupId}/members/${memberId}/remove`)
		return response.data
	},

	// Lista członków grupy
	getGroupMembers: async groupId => {
		const response = await axiosInstance.get(`/groups/${groupId}/members`)
		return response.data
	},

	// Opuszczenie grupy
	leaveGroup: async groupId => {
		const response = await axiosInstance.post(`/groups/${groupId}/leave`)
		return response.data
	},

	// Zmiana nazwy grupy
	updateGroupName: async (groupId, groupName) => {
		const response = await axiosInstance.put(`/groups/${groupId}/name`, {
			groupName,
		})
		return response.data
	},

	// Usunięcie grupy
	deleteGroup: async groupId => {
		const response = await axiosInstance.delete(`/groups/${groupId}`)
		return response.data
	},

	getGroupDetails: async groupId => {
		const response = await axiosInstance.get(`/groups/${groupId}`)
		return response.data
	},
}
