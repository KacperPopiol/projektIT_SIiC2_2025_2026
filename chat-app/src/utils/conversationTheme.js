const { chatThemes, chatThemesMap } = require('../config/chatThemes')

const normalizeThemeKey = themeKey => {
	if (!themeKey || typeof themeKey !== 'string') {
		return 'default'
	}
	const trimmed = themeKey.trim()
	return trimmed.length > 0 ? trimmed : 'default'
}

const buildStoredThemeSettings = (themeDefinition, userId) => {
	const now = new Date()

	return {
		name: themeDefinition.name,
		variables: themeDefinition.variables,
		updated_at: now,
		updated_by: userId,
	}
}

const resolveThemeForConversation = conversationInstance => {
	const activeThemeKey = conversationInstance.theme_key || 'default'
	const themeDefinition = chatThemesMap[activeThemeKey] || chatThemesMap.default
	const persistedThemeSettings = conversationInstance.theme_settings

	if (persistedThemeSettings && typeof persistedThemeSettings === 'object') {
		return {
			key: activeThemeKey,
			name: persistedThemeSettings.name || themeDefinition?.name || activeThemeKey,
			variables: persistedThemeSettings.variables || themeDefinition?.variables || {},
		}
	}

	if (themeDefinition) {
		return {
			key: themeDefinition.key,
			name: themeDefinition.name,
			variables: themeDefinition.variables,
		}
	}

	return {
		key: 'default',
		name: 'Domyślny',
		variables: chatThemesMap.default?.variables || {},
	}
}

const applyThemeToConversation = async ({ conversation, themeKey, userId }) => {
	const normalizedThemeKey = normalizeThemeKey(themeKey)
	const themeDefinition = chatThemesMap[normalizedThemeKey]

	if (!themeDefinition) {
		const error = new Error('Wybrany motyw nie istnieje')
		error.statusCode = 400
		throw error
	}

	const storedSettings = buildStoredThemeSettings(themeDefinition, userId)

	await conversation.update({
		theme_key: themeDefinition.key,
		theme_settings: storedSettings,
	})

	// Zaktualizuj instancję w pamięci
	conversation.theme_key = themeDefinition.key
	conversation.theme_settings = storedSettings

	return {
		key: themeDefinition.key,
		name: themeDefinition.name,
		variables: themeDefinition.variables,
	}
}

module.exports = {
	chatThemes,
	chatThemesMap,
	normalizeThemeKey,
	resolveThemeForConversation,
	applyThemeToConversation,
}

