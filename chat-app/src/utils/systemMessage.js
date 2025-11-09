const db = require('../models')

const SYSTEM_MESSAGE_TYPES = {
	THEME_CHANGE: 'theme_change',
}

const buildThemeChangeContent = ({ username, themeName }) => {
	return `${username} zmienił(a) motyw czatu na „${themeName}”.`
}

const createThemeChangeSystemMessage = async ({ conversationId, userId, username, theme }) => {
	return db.Message.create({
		conversation_id: conversationId,
		sender_id: userId,
		content: buildThemeChangeContent({ username, themeName: theme.name }),
		is_encrypted: false,
		message_type: 'system',
		system_payload: {
			type: SYSTEM_MESSAGE_TYPES.THEME_CHANGE,
			themeKey: theme.key,
			themeName: theme.name,
			variables: theme.variables,
		},
	})
}

module.exports = {
	SYSTEM_MESSAGE_TYPES,
	createThemeChangeSystemMessage,
}

