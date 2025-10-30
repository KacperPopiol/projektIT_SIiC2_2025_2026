import { useEffect, useState } from 'react'
import { useNotifications } from '../../hooks/useNotifications'

const NotificationSettings = () => {
    const { permission, requestPermission, settings, updateSettings, loadSettings } = useNotifications()
    const [localSettings, setLocalSettings] = useState({
        notifications_enabled: true,
        notify_private_messages: true,
        notify_group_messages: true,
    })

    useEffect(() => {
        if (!settings) {
            loadSettings()
        } else {
            setLocalSettings(settings)
        }
    }, [settings])

    const handleToggle = async key => {
        const next = { ...localSettings, [key]: !localSettings[key] }
        setLocalSettings(next)
        try {
            await updateSettings(next)
        } catch (e) {
            // Revert on failure
            setLocalSettings(localSettings)
            alert('Nie udało się zapisać ustawień')
        }
    }

    const handleRequestPermission = async () => {
        const result = await requestPermission()
        if (result === 'granted') alert('Uprawnienia przyznane')
        if (result === 'denied') alert('Uprawnienia odrzucone w przeglądarce')
    }

    // Prosty komponent Switch (bez bibliotek)
    const Switch = ({ checked, onChange, label }) => {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px' }}>{label}</span>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px' }}>
                    <input
                        type='checkbox'
                        checked={!!checked}
                        onChange={onChange}
                        style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                        style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: checked ? '#28a745' : '#ccc',
                            transition: '0.2s',
                            borderRadius: '999px',
                        }}
                    />
                    <span
                        style={{
                            position: 'absolute',
                            content: "''",
                            height: '22px',
                            width: '22px',
                            left: checked ? '22px' : '2px',
                            bottom: '2px',
                            backgroundColor: 'white',
                            transition: '0.2s',
                            borderRadius: '50%',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                    />
                </label>
            </div>
        )
    }

    return (
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #eee' }}>
            <h3 style={{ marginTop: 0 }}>🔔 Powiadomienia</h3>

            <div style={{ marginBottom: '10px', fontSize: '13px', color: '#666' }}>Status uprawnień przeglądarki: {permission}</div>

            {permission !== 'granted' && (
                <button
                    onClick={handleRequestPermission}
                    style={{ padding: '8px 12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px' }}>
                    Poproś o uprawnienia
                </button>
            )}

            <div style={{ marginTop: '15px' }}>
                <Switch
                    checked={!!localSettings.notifications_enabled}
                    onChange={() => handleToggle('notifications_enabled')}
                    label='Włącz powiadomienia'
                />
                <Switch
                    checked={!!localSettings.notify_private_messages}
                    onChange={() => handleToggle('notify_private_messages')}
                    label='Prywatne wiadomości'
                />
                <Switch
                    checked={!!localSettings.notify_group_messages}
                    onChange={() => handleToggle('notify_group_messages')}
                    label='Wiadomości grupowe'
                />
            </div>

            {/* Auto-zapis po zmianie switcha – bez przycisku zapisu */}
        </div>
    )
}

export default NotificationSettings


