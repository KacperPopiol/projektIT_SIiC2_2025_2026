const Loading = () => {
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				height: '100vh',
				flexDirection: 'column',
			}}>
			<div
				style={{
					width: '50px',
					height: '50px',
					border: '5px solid #f3f3f3',
					borderTop: '5px solid #007bff',
					borderRadius: '50%',
					animation: 'spin 1s linear infinite',
				}}
			/>
			<p style={{ marginTop: '20px', color: '#666' }}>Ładowanie...</p>
			<style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
		</div>
	)
}

export default Loading
