import React, { useState } from 'react'
import { Header } from '../components/Header'
import '../styles/pages.css'

interface DayAvailability {
  date: string
  dayName: string
  available: boolean
  slots: { time: string; label: string; selected: boolean }[]
}

export const MultiDayAvailability: React.FC = () => {
  const [days, setDays] = useState<DayAvailability[]>([
    {
      date: '2024-08-17',
      dayName: 'Saturday, Aug 17',
      available: true,
      slots: [
        { time: '9:00 AM', label: 'Morning', selected: true },
        { time: '1:00 PM', label: 'Afternoon', selected: false },
        { time: '5:00 PM', label: 'Evening', selected: false },
        { time: 'Full Day', label: 'All Day', selected: false },
      ]
    },
    {
      date: '2024-08-18',
      dayName: 'Sunday, Aug 18',
      available: false,
      slots: [
        { time: '9:00 AM', label: 'Morning', selected: false },
        { time: '1:00 PM', label: 'Afternoon', selected: false },
        { time: '5:00 PM', label: 'Evening', selected: false },
        { time: 'Full Day', label: 'All Day', selected: false },
      ]
    },
    {
      date: '2024-08-19',
      dayName: 'Monday, Aug 19',
      available: true,
      slots: [
        { time: '9:00 AM', label: 'Morning', selected: false },
        { time: '1:00 PM', label: 'Afternoon', selected: true },
        { time: '5:00 PM', label: 'Evening', selected: false },
        { time: 'Full Day', label: 'All Day', selected: false },
      ]
    },
  ])

  const toggleDay = (dayIndex: number) => {
    const newDays = [...days]
    newDays[dayIndex].available = !newDays[dayIndex].available
    setDays(newDays)
  }

  const toggleSlot = (dayIndex: number, slotIndex: number) => {
    if (!days[dayIndex].available) return
    const newDays = [...days]
    const slot = newDays[dayIndex].slots[slotIndex]
    // Toggle selection
    newDays[dayIndex].slots = newDays[dayIndex].slots.map((s, i) => ({
      ...s,
      selected: i === slotIndex ? !slot.selected : s.selected
    }))
    setDays(newDays)
  }

  return (
    <div className="mobile-container">
      <div className="availability-screen">
        <Header
          title="Your Availability"
          subtitle="When can you volunteer?"
          showBack={true}
        />

        <div className="availability-content">
          <p style={{
            marginBottom: 'var(--spacing-lg)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)'
          }}>
            Select the days and times you're available to volunteer. You can select multiple time slots per day.
          </p>

          {days.map((day, dayIndex) => (
            <div key={day.date} className="day-card">
              <div className="day-card-header">
                <div>
                  <h3 className="day-card-title">{day.dayName}</h3>
                </div>
                <div
                  className={`day-toggle ${day.available ? 'active' : ''}`}
                  onClick={() => toggleDay(dayIndex)}
                  role="switch"
                  aria-checked={day.available}
                />
              </div>

              {day.available && (
                <div className="time-slots">
                  {day.slots.map((slot, slotIndex) => (
                    <div
                      key={slotIndex}
                      className={`time-slot ${slot.selected ? 'selected' : ''}`}
                      onClick={() => toggleSlot(dayIndex, slotIndex)}
                    >
                      <p className="time-slot-time">{slot.time}</p>
                      <p className="time-slot-label">{slot.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Summary */}
          <div style={{
            marginTop: 'var(--spacing-lg)',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Availability slots selected:
            </p>
            <p style={{
              margin: 'var(--spacing-xs) 0 0 0',
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 700,
              color: 'var(--color-primary)'
            }}>
              {days.reduce((total, day) => total + day.slots.filter(s => s.selected).length, 0)} slots
            </p>
          </div>

          <button className="btn btn-primary btn-large" style={{ marginTop: 'var(--spacing-lg)' }}>
            Save Availability
          </button>
        </div>
      </div>
    </div>
  )
}
