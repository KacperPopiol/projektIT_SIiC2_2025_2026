const TypingIndicator = ({ username }) => {
	return (
		<div
			style={{
				padding: '10px 20px',
				fontSize: '12px',
				color: 'var(--color-text-muted)',
				fontStyle: 'italic',
			}}>
			{username} pisze...
		</div>
	)
}

export default TypingIndicator
