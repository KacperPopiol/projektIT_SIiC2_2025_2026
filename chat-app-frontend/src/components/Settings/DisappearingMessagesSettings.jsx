import { useEffect, useState } from 'react'
import { usersApi } from '../../api/usersApi'

const DisappearingMessagesSettings = () => {
    const [defaultTime, setDefaultTime] = useState(60)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
            const response = await usersApi.getDefaultDisappearingTime()
            if (response.success && response.defaultDisappearingTime) {
                setDefaultTime(response.defaultDisappearingTime)
            }
        } catch (error) {
            console.error('Błąd ładowania ustawień czasu znikania:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleTimeChange = async event => {
        const newTime = parseInt(event.target.value)
        setDefaultTime(newTime)
        setSaving(true)

        try {
            await usersApi.updateDefaultDisappearingTime(newTime)
        } catch (error) {
            console.error('Błąd zapisywania czasu:', error)
            alert('Nie udało się zapisać ustawień')
            // Cofnij zmianę
            loadSettings()
        } finally {
            setSaving(false)
        }
    }

    const formatTime = seconds => {
        if (seconds < 60) {
            return `${seconds} sekund${seconds !== 1 ? 'y' : 'a'}`
        } else if (seconds < 3600) {
            const minutes = seconds / 60
            return `${minutes} minut${minutes !== 1 ? 'y' : 'a'}`
        } else if (seconds < 86400) {
            const hours = seconds / 3600
            return `${hours} godzin${hours !== 1 ? 'y' : 'a'}`
        } else {
            const days = seconds / 86400
            return `${days} dzień${days !== 1 ? 'ni' : ''}`
        }
    }

    if (loading) {
        return (
            <div style={{ background: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #eee' }}>
                <p>Ładowanie...</p>
            </div>
        )
    }

    return (
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', border: '1px solid #eee' }}>
            <h3 style={{ marginTop: 0 }}>⏱️ Znikające wiadomości</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                Domyślny czas po którym wiadomości znikają po przeczytaniu. Ustawienie dotyczy wszystkich nowych chatów z włączonym trybem znikających wiadomości.
            </p>

            <div style={{ marginBottom: '10px' }}>
                <label
                    style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                    }}>
                    Czas znikania:
                </label>
                <select
                    value={defaultTime}
                    onChange={handleTimeChange}
                    disabled={saving}
                    style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '5px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        backgroundColor: saving ? '#f5f5f5' : 'white',
                        cursor: saving ? 'not-allowed' : 'pointer',
                    }}>
                    <option value={30}>30 sekund</option>
                    <option value={60}>1 minuta</option>
                    <option value={300}>5 minut</option>
                    <option value={3600}>1 godzina</option>
                    <option value={86400}>24 godziny</option>
                </select>
            </div>

            {saving && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Zapisywanie...</div>
            )}

            {!saving && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Aktualnie ustawione: <strong>{formatTime(defaultTime)}</strong>
                </div>
            )}
        </div>
    )
}

export default DisappearingMessagesSettings

