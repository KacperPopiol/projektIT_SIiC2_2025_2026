export const CHAT_THEMES = [
	{
		key: 'default',
		name: 'Domyślny',
		preview: 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)',
		variables: {
			accentColor: 'var(--color-accent)',
			backgroundColor: 'var(--chat-background)',
			backgroundImage: null,
			incomingBubbleColor: 'var(--chat-bubble-incoming-bg)',
			incomingTextColor: 'var(--chat-bubble-incoming-text)',
			outgoingBubbleColor: 'var(--chat-bubble-outgoing-bg)',
			outgoingTextColor: 'var(--chat-bubble-outgoing-text)',
			systemTextColor: 'var(--chat-system-text)',
			headerBackgroundColor: 'var(--chat-header-bg)',
			headerBorderColor: 'var(--chat-header-border)',
			menuBackgroundColor: 'var(--chat-menu-bg)',
			menuBorderColor: 'var(--chat-menu-border)',
			menuTextColor: 'var(--chat-menu-text)',
			menuHoverBackgroundColor: 'var(--chat-menu-hover-bg)',
			typingBackgroundColor: 'var(--chat-typing-bg)',
			systemBorderColor: 'var(--chat-system-border)',
			systemBackgroundColor: 'var(--chat-system-background)',
			inputBorderColor: 'var(--chat-input-border)',
			inputBorderSoftColor: 'var(--chat-input-border-soft)',
			inputBackgroundColor: 'var(--chat-input-background)',
		},
	},
	{
		key: 'sunset',
		name: 'Zachód słońca',
		preview: 'linear-gradient(135deg, #ff7a18 0%, #af002d 74%)',
		variables: {
			accentColor: '#ff7a18',
			backgroundColor: '#2d0a1c',
			backgroundImage: 'linear-gradient(135deg, rgba(255,122,24,0.2) 0%, rgba(175,0,45,0.4) 100%)',
			incomingBubbleColor: 'rgba(255,255,255,0.15)',
			incomingTextColor: '#ffebd6',
			outgoingBubbleColor: '#ff7a18',
			outgoingTextColor: '#ffffff',
			systemTextColor: '#ffd6a5',
		},
	},
	{
		key: 'forest',
		name: 'Leśny',
		preview: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
		variables: {
			accentColor: '#71b280',
			backgroundColor: '#0f2f35',
			backgroundImage: 'linear-gradient(135deg, rgba(19,78,94,0.4) 0%, rgba(113,178,128,0.35) 100%)',
			incomingBubbleColor: 'rgba(255,255,255,0.12)',
			incomingTextColor: '#e2f6e9',
			outgoingBubbleColor: '#71b280',
			outgoingTextColor: '#0f2f35',
			systemTextColor: '#9ed7b2',
		},
	},
	{
		key: 'midnight',
		name: 'Północ',
		preview: 'linear-gradient(135deg, #000428 0%, #004e92 100%)',
		variables: {
			accentColor: '#4dabf7',
			backgroundColor: '#020917',
			backgroundImage: 'linear-gradient(135deg, rgba(0,4,40,0.65) 0%, rgba(0,78,146,0.4) 100%)',
			incomingBubbleColor: 'rgba(255,255,255,0.08)',
			incomingTextColor: '#dfe9ff',
			outgoingBubbleColor: '#4dabf7',
			outgoingTextColor: '#04122b',
			systemTextColor: '#8fb7ff',
		},
	},
	{
		key: 'lavender',
		name: 'Lawenda',
		preview: 'linear-gradient(135deg, #ad80ff 0%, #f7b2ff 100%)',
		variables: {
			accentColor: '#ad80ff',
			backgroundColor: '#f3ecff',
			backgroundImage: 'linear-gradient(135deg, rgba(173,128,255,0.25) 0%, rgba(247,178,255,0.35) 100%)',
			incomingBubbleColor: '#ffffff',
			incomingTextColor: '#493058',
			outgoingBubbleColor: '#ad80ff',
			outgoingTextColor: '#ffffff',
			systemTextColor: '#6f4a82',
		},
	},
	{
		key: 'ocean',
		name: 'Oceaniczny',
		preview: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
		variables: {
			accentColor: '#00c6ff',
			backgroundColor: '#062946',
			backgroundImage: 'linear-gradient(135deg, rgba(0,198,255,0.2) 0%, rgba(0,114,255,0.35) 100%)',
			incomingBubbleColor: 'rgba(255,255,255,0.1)',
			incomingTextColor: '#d7f1ff',
			outgoingBubbleColor: '#00c6ff',
			outgoingTextColor: '#01365a',
			systemTextColor: '#89d3ff',
		},
	},
	{
		key: 'nebula',
		name: 'Mgławica',
		preview: 'linear-gradient(135deg, #251351 0%, #9c1de7 50%, #fcb1ff 100%)',
		variables: {
			accentColor: '#fcb1ff',
			backgroundColor: '#120327',
			backgroundImage: 'linear-gradient(160deg, rgba(252,177,255,0.35) 0%, rgba(19,132,150,0.25) 100%)',
			incomingBubbleColor: 'rgba(255,255,255,0.12)',
			incomingTextColor: '#f5d9ff',
			outgoingBubbleColor: '#9c1de7',
			outgoingTextColor: '#f9efff',
			systemTextColor: '#d79dee',
		},
	},
	{
		key: 'aurora',
		name: 'Zorza polarna',
		preview: 'linear-gradient(135deg, #0b486b 0%, #f56217 100%)',
		variables: {
			accentColor: '#0bffb0',
			backgroundColor: '#00131f',
			backgroundImage: 'linear-gradient(120deg, rgba(15,255,176,0.25) 0%, rgba(139,233,253,0.2) 50%, rgba(255,97,56,0.25) 100%)',
			incomingBubbleColor: 'rgba(255,255,255,0.08)',
			incomingTextColor: '#e5ffff',
			outgoingBubbleColor: '#0bffb0',
			outgoingTextColor: '#012b1f',
			systemTextColor: '#9cfef0',
		},
	},
	{
		key: 'cyberpunk',
		name: 'Cyberpunk',
		preview: 'linear-gradient(135deg, #ff0080 0%, #7928ca 50%, #2afadf 100%)',
		variables: {
			accentColor: '#ff0080',
			backgroundColor: '#05020a',
			backgroundImage: 'linear-gradient(135deg, rgba(255,0,128,0.25) 0%, rgba(42,250,223,0.2) 100%)',
			incomingBubbleColor: 'rgba(255,255,255,0.1)',
			incomingTextColor: '#f4e5ff',
			outgoingBubbleColor: '#ff0080',
			outgoingTextColor: '#080108',
			systemTextColor: '#ff62b9',
		},
	},
	{
		key: 'sunrise',
		name: 'Poranek w tropikach',
		preview: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 55%, #fad0c4 100%)',
		variables: {
			accentColor: '#ff9a9e',
			backgroundColor: '#fff4e6',
			backgroundImage: 'linear-gradient(135deg, rgba(255,181,167,0.45) 0%, rgba(255,228,196,0.35) 100%)',
			incomingBubbleColor: '#ffffff',
			incomingTextColor: '#8a4f2b',
			outgoingBubbleColor: '#ff9a9e',
			outgoingTextColor: '#4a1f1f',
			systemTextColor: '#c26a5d',
		},
	},
	{
		key: 'deep_space',
		name: 'Głęboka przestrzeń',
		preview: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
		variables: {
			accentColor: '#39a0ed',
			backgroundColor: '#040b11',
			backgroundImage:
				'radial-gradient(circle at 20% 20%, rgba(57,160,237,0.35), transparent 60%), radial-gradient(circle at 80% 30%, rgba(172,126,241,0.25), transparent 55%)',
			incomingBubbleColor: 'rgba(255,255,255,0.08)',
			incomingTextColor: '#d6e9ff',
			outgoingBubbleColor: '#39a0ed',
			outgoingTextColor: '#02131f',
			systemTextColor: '#8fbce8',
		},
	},
]

export const CHAT_THEME_MAP = CHAT_THEMES.reduce((acc, theme) => {
	acc[theme.key] = theme
	return acc
}, {})

export const getChatTheme = themeKey => {
	if (!themeKey) {
		return CHAT_THEME_MAP.default
	}
	return CHAT_THEME_MAP[themeKey] || CHAT_THEME_MAP.default
}

