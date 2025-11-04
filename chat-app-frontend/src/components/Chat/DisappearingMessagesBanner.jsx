import { useEffect, useState } from 'react'

const DisappearingMessagesBanner = ({ disappearingTime }) => {
    const [timeText, setTimeText] = useState('')

    useEffect(() => {
        // Formatuj czas w sekundach na czytelny tekst
        const formatTime = seconds => {
            if (seconds < 60) {
                return `${seconds} sekund${seconds !== 1 ? 'y' : 'a'}`
            } else if (seconds < 3600) {
                const minutes = Math.floor(seconds / 60)
                return `${minutes} minut${minutes !== 1 ? 'y' : 'a'}`
            } else if (seconds < 86400) {
                const hours = Math.floor(seconds / 3600)
                return `${hours} godzin${hours !== 1 ? 'y' : 'a'}`
            } else {
                const days = Math.floor(seconds / 86400)
                return `${days} dzień${days !== 1 ? 'ni' : ''}`
            }
        }

        if (disappearingTime) {
            setTimeText(formatTime(disappearingTime))
        }
    }, [disappearingTime])

    if (!disappearingTime) {
        return null
    }

    return (
        <div
            style={{
                backgroundColor: '#fff3cd',
                border: '2px solid #ffc107',
                padding: '12px 16px',
                borderRadius: '8px',
                margin: '0 15px 15px 15px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
            <span style={{ fontSize: '20px' }}>⏱️</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#856404' }}>
                    Tryb znikających wiadomości aktywny
                </div>
                <div style={{ fontSize: '12px', color: '#856404', marginTop: '2px' }}>
                    Wiadomości w tym czacie znikają po {timeText} od przeczytania
                </div>
            </div>
        </div>
    )
}

export default DisappearingMessagesBanner

