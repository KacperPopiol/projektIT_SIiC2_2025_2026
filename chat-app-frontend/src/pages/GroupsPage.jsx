import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { groupsApi } from '../api/groupsApi'
import { useAuth } from '../hooks/useAuth'

const GroupsPage = () => {
	const navigate = useNavigate()
	const { user } = useAuth()

	const [groups, setGroups] = useState([])
	const [selectedGroup, setSelectedGroup] = useState(null)
	const [groupMembers, setGroupMembers] = useState([])
	const [pendingRequests, setPendingRequests] = useState([])

	const [showCreateGroup, setShowCreateGroup] = useState(false)
	const [groupName, setGroupName] = useState('')

	const [showJoinGroup, setShowJoinGroup] = useState(false)
	const [inviteCode, setInviteCode] = useState('')

	const [generatedCode, setGeneratedCode] = useState('')
	const [showGeneratedCode, setShowGeneratedCode] = useState(false)

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		loadGroups()
	}, [])

	useEffect(() => {
		const interval = setInterval(() => {
			console.log('🔄 Auto-refreshing groups...')
			loadGroups()
			if (selectedGroup) {
				loadGroupDetails(selectedGroup.group_id)
			}
		}, 3000) // 3 sekundy

		return () => clearInterval(interval)
	}, [selectedGroup])

	useEffect(() => {
		if (selectedGroup) {
			loadGroupDetails(selectedGroup.group_id)
		}
	}, [selectedGroup])

	const loadGroups = async () => {
		try {
			const response = await groupsApi.getMyGroups()
			setGroups(response.groups || [])
		} catch (err) {
			console.error('Błąd ładowania grup:', err)
			setError('Nie udało się załadować grup')
		} finally {
			setLoading(false)
		}
	}

	const isGroupCreator = groupId => {
		const groupMember = groups.find(g => g.group_id === groupId)
		return groupMember?.role === 'creator'
	}

	const loadGroupDetails = async groupId => {
		try {
			// Zawsze pobierz członków (każdy członek ma dostęp)
			const membersRes = await groupsApi.getGroupMembers(groupId)
			setGroupMembers(membersRes.members || [])

			// ✅ Pobierz oczekujące prośby TYLKO jeśli jesteś twórcą
			if (isGroupCreator(groupId)) {
				try {
					const pendingRes = await groupsApi.getPendingRequests(groupId)
					setPendingRequests(pendingRes.pendingRequests || [])
				} catch (err) {
					console.log('Nie można pobrać oczekujących próśb (brak uprawnień)')
					setPendingRequests([])
				}
			} else {
				// Jeśli nie jesteś twórcą, wyczyść listę oczekujących
				setPendingRequests([])
			}
		} catch (err) {
			console.error('Błąd ładowania szczegółów grupy:', err)
		}
	}

	const handleCreateGroup = async e => {
		e.preventDefault()
		try {
			setError('')
			await groupsApi.createGroup(groupName)
			setShowCreateGroup(false)
			setGroupName('')
			alert('Grupa utworzona pomyślnie!')
			await loadGroups()
		} catch (err) {
			setError(err.response?.data?.error || 'Nie udało się utworzyć grupy')
		}
	}

	const handleGenerateInvite = async groupId => {
		try {
			const response = await groupsApi.generateGroupInvite(groupId)
			setGeneratedCode(response.inviteCode)
			setShowGeneratedCode(true)

			setTimeout(() => {
				setShowGeneratedCode(false)
				setGeneratedCode('')
			}, 60000)
		} catch (err) {
			alert('Błąd generowania kodu')
		}
	}

	const handleJoinGroup = async e => {
		e.preventDefault()
		try {
			setError('')
			await groupsApi.requestJoinGroup(inviteCode)
			setShowJoinGroup(false)
			setInviteCode('')
			alert('Prośba o dołączenie wysłana!')
			await loadGroups()
		} catch (err) {
			setError(err.response?.data?.error || 'Nie udało się dołączyć do grupy')
		}
	}

	const handleAcceptMember = async (groupId, memberId) => {
		try {
			await groupsApi.acceptMember(groupId, memberId)
			alert('Członek zaakceptowany!')
			await loadGroupDetails(groupId)
		} catch (err) {
			alert('Błąd akceptacji członka')
		}
	}

	const handleRejectMember = async (groupId, memberId) => {
		try {
			await groupsApi.rejectMember(groupId, memberId)
			alert('Prośba odrzucona')
			await loadGroupDetails(groupId)
		} catch (err) {
			alert('Błąd odrzucania prośby')
		}
	}

	const handleRemoveMember = async (groupId, memberId) => {
		if (!confirm('Czy na pewno chcesz usunąć tego członka?')) return

		try {
			await groupsApi.removeMember(groupId, memberId)
			alert('Członek usunięty')
			loadGroupDetails(groupId)
		} catch (err) {
			alert('Błąd usuwania członka')
		}
	}

	const handleLeaveGroup = async groupId => {
		if (!confirm('Czy na pewno chcesz opuścić tę grupę?')) return

		try {
			await groupsApi.leaveGroup(groupId)
			alert('Opuściłeś grupę')
			setSelectedGroup(null)
			loadGroups()
		} catch (err) {
			alert('Błąd opuszczania grupy')
		}
	}

	const handleDeleteGroup = async groupId => {
		if (!confirm('Czy na pewno chcesz usunąć tę grupę? Wszystkie wiadomości zostaną usunięte!')) return

		try {
			await groupsApi.deleteGroup(groupId)
			alert('Grupa usunięta')
			setSelectedGroup(null)
			loadGroups()
		} catch (err) {
			alert('Błąd usuwania grupy')
		}
	}

	if (loading) {
		return <div style={{ padding: '20px' }}>Ładowanie...</div>
	}

	return (
		<div style={{ display: 'flex', height: '100vh' }}>
			{/* Sidebar - Lista grup */}
			<div
				style={{
					width: '300px',
					borderRight: '1px solid #ddd',
					backgroundColor: '#f8f9fa',
					overflowY: 'auto',
					padding: '20px',
				}}>
				<button
					onClick={() => navigate('/chat')}
					style={{
						width: '100%',
						padding: '10px',
						backgroundColor: '#6c757d',
						color: 'white',
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						marginBottom: '15px',
					}}>
					← Wróć do Czatu
				</button>

				<h2>🎯 Grupy</h2>
				<p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>{user?.username}</p>

				<button
					onClick={() => setShowCreateGroup(!showCreateGroup)}
					style={{
						width: '100%',
						padding: '12px',
						backgroundColor: '#28a745',
						color: 'white',
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						marginBottom: '10px',
						fontWeight: 'bold',
					}}>
					➕ Utwórz Grupę
				</button>

				<button
					onClick={() => setShowJoinGroup(!showJoinGroup)}
					style={{
						width: '100%',
						padding: '12px',
						backgroundColor: '#007bff',
						color: 'white',
						border: 'none',
						borderRadius: '5px',
						cursor: 'pointer',
						marginBottom: '20px',
						fontWeight: 'bold',
					}}>
					🔑 Dołącz do Grupy
				</button>

				{/* Formularz tworzenia grupy */}
				{showCreateGroup && (
					<form onSubmit={handleCreateGroup} style={{ marginBottom: '20px' }}>
						<input
							type='text'
							value={groupName}
							onChange={e => setGroupName(e.target.value)}
							placeholder='Nazwa grupy'
							style={{
								width: '100%',
								padding: '10px',
								borderRadius: '5px',
								border: '1px solid #ddd',
								marginBottom: '10px',
							}}
							required
						/>
						<button
							type='submit'
							style={{
								width: '100%',
								padding: '10px',
								backgroundColor: '#28a745',
								color: 'white',
								border: 'none',
								borderRadius: '5px',
								cursor: 'pointer',
							}}>
							Utwórz
						</button>
					</form>
				)}

				{/* Formularz dołączania do grupy */}
				{showJoinGroup && (
					<form onSubmit={handleJoinGroup} style={{ marginBottom: '20px' }}>
						<input
							type='text'
							value={inviteCode}
							onChange={e => setInviteCode(e.target.value.toUpperCase())}
							placeholder='Kod zaproszenia'
							maxLength={6}
							style={{
								width: '100%',
								padding: '10px',
								borderRadius: '5px',
								border: '1px solid #ddd',
								marginBottom: '10px',
								textAlign: 'center',
								fontFamily: 'monospace',
								letterSpacing: '3px',
							}}
							required
						/>
						<button
							type='submit'
							style={{
								width: '100%',
								padding: '10px',
								backgroundColor: '#007bff',
								color: 'white',
								border: 'none',
								borderRadius: '5px',
								cursor: 'pointer',
							}}>
							Dołącz
						</button>
					</form>
				)}

				{error && (
					<div
						style={{
							backgroundColor: '#f8d7da',
							color: '#721c24',
							padding: '10px',
							borderRadius: '5px',
							marginBottom: '15px',
							fontSize: '12px',
						}}>
						{error}
					</div>
				)}

				<h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Twoje Grupy</h3>
				{groups.length === 0 ? (
					<p style={{ fontSize: '12px', color: '#999' }}>Brak grup</p>
				) : (
					groups.map(groupMember => {
						const group = groupMember.group
						return (
							<div
								key={group.group_id}
								onClick={() => setSelectedGroup(group)}
								style={{
									padding: '12px',
									backgroundColor: selectedGroup?.group_id === group.group_id ? '#007bff' : '#fff',
									color: selectedGroup?.group_id === group.group_id ? '#fff' : '#000',
									borderRadius: '5px',
									cursor: 'pointer',
									marginBottom: '8px',
									border: '1px solid #ddd',
								}}>
								<strong>{group.group_name}</strong>
								<div style={{ fontSize: '11px', opacity: 0.8, marginTop: '5px' }}>
									{groupMember.role === 'creator' ? '👑 Twórca' : '👤 Członek'}
								</div>
							</div>
						)
					})
				)}
			</div>

			{/* Szczegóły grupy */}
			<div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
				{selectedGroup ? (
					<>
						<h2>{selectedGroup.group_name}</h2>

						{/* Kod zaproszeniowy */}
						{showGeneratedCode && generatedCode && (
							<div
								style={{
									backgroundColor: '#d4edda',
									border: '2px solid #28a745',
									padding: '15px',
									borderRadius: '8px',
									marginBottom: '20px',
								}}>
								<h4>Kod Zaproszeniowy:</h4>
								<div
									style={{
										fontSize: '24px',
										fontWeight: 'bold',
										fontFamily: 'monospace',
										letterSpacing: '5px',
										margin: '10px 0',
									}}>
									{generatedCode}
								</div>
								<p style={{ fontSize: '12px' }}>Ważny przez 60 sekund!</p>
							</div>
						)}

						{/* Akcje twórcy */}
						{groups.find(g => g.group_id === selectedGroup.group_id)?.role === 'creator' && (
							<div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
								<button
									onClick={() => handleGenerateInvite(selectedGroup.group_id)}
									style={{
										padding: '10px 15px',
										backgroundColor: '#28a745',
										color: 'white',
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
									}}>
									🔑 Generuj Kod
								</button>
								<button
									onClick={() => handleDeleteGroup(selectedGroup.group_id)}
									style={{
										padding: '10px 15px',
										backgroundColor: '#dc3545',
										color: 'white',
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
									}}>
									🗑️ Usuń Grupę
								</button>
							</div>
						)}

						{/* Akcje członka */}
						{groups.find(g => g.group_id === selectedGroup.group_id)?.role === 'member' && (
							<button
								onClick={() => handleLeaveGroup(selectedGroup.group_id)}
								style={{
									padding: '10px 15px',
									backgroundColor: '#ffc107',
									color: '#000',
									border: 'none',
									borderRadius: '5px',
									cursor: 'pointer',
									marginBottom: '20px',
								}}>
								🚪 Opuść Grupę
							</button>
						)}

						{/* Oczekujące prośby (tylko twórca) */}
						{pendingRequests.length > 0 &&
							groups.find(g => g.group_id === selectedGroup.group_id)?.role === 'creator' && (
								<div style={{ marginBottom: '30px' }}>
									<h3>📩 Oczekujące Prośby ({pendingRequests.length})</h3>
									{pendingRequests.map(request => (
										<div
											key={request.member_id}
											style={{
												backgroundColor: '#fff3cd',
												padding: '15px',
												borderRadius: '8px',
												marginTop: '10px',
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
											}}>
											<strong>{request.user?.username}</strong>
											<div style={{ display: 'flex', gap: '10px' }}>
												<button
													onClick={() => handleAcceptMember(selectedGroup.group_id, request.user_id)}
													style={{
														padding: '8px 15px',
														backgroundColor: '#28a745',
														color: 'white',
														border: 'none',
														borderRadius: '5px',
														cursor: 'pointer',
													}}>
													✅ Akceptuj
												</button>
												<button
													onClick={() => handleRejectMember(selectedGroup.group_id, request.user_id)}
													style={{
														padding: '8px 15px',
														backgroundColor: '#dc3545',
														color: 'white',
														border: 'none',
														borderRadius: '5px',
														cursor: 'pointer',
													}}>
													❌ Odrzuć
												</button>
											</div>
										</div>
									))}
								</div>
							)}

						{/* Członkowie */}
						<div>
							<h3>👥 Członkowie ({groupMembers.length})</h3>
							{groupMembers.map(member => (
								<div
									key={member.member_id}
									style={{
										backgroundColor: '#fff',
										padding: '15px',
										borderRadius: '8px',
										marginTop: '10px',
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										border: '1px solid #ddd',
									}}>
									<div>
										<strong>{member.user?.username}</strong>
										<div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
											{member.role === 'creator' ? '👑 Twórca' : '👤 Członek'}
										</div>
									</div>
									{member.role !== 'creator' &&
										groups.find(g => g.group_id === selectedGroup.group_id)?.role === 'creator' && (
											<button
												onClick={() => handleRemoveMember(selectedGroup.group_id, member.user_id)}
												style={{
													padding: '8px 15px',
													backgroundColor: '#dc3545',
													color: 'white',
													border: 'none',
													borderRadius: '5px',
													cursor: 'pointer',
												}}>
												Usuń
											</button>
										)}
								</div>
							))}
						</div>
					</>
				) : (
					<div
						style={{
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							height: '100%',
							color: '#999',
						}}>
						<p>Wybierz grupę aby zobaczyć szczegóły</p>
					</div>
				)}
			</div>
		</div>
	)
}

export default GroupsPage
