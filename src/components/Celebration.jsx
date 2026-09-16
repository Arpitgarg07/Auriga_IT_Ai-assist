import { useEffect, useMemo, useState } from 'react'
import { Check, Flame, PartyPopper, Sparkles, Trophy } from 'lucide-react'
import { milestoneLabel } from '../utils/constants.js'

const CONFETTI_COLORS = ['#1d6b51', '#f5c76a', '#e18c5b', '#80b891', '#d6eadb', '#b18425']

// Deterministic pseudo-random so a re-render never reshuffles pieces mid-animation.
function seeded(index, salt) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

export function Confetti({ pieces = 54 }) {
  const items = useMemo(
    () => Array.from({ length: pieces }, (_, index) => ({
      id: index,
      left: seeded(index, 1) * 100,
      delay: seeded(index, 2) * 0.9,
      duration: 2.2 + seeded(index, 3) * 1.6,
      drift: (seeded(index, 4) - 0.5) * 160,
      spin: 360 + seeded(index, 5) * 720,
      size: 6 + seeded(index, 6) * 7,
      color: CONFETTI_COLORS[Math.floor(seeded(index, 7) * CONFETTI_COLORS.length)],
      round: seeded(index, 8) > 0.6,
    })),
    [pieces],
  )
  return (
    <div className="confetti-layer" aria-hidden="true">
      {items.map((item) => (
        <span
          key={item.id}
          className={`confetti-piece ${item.round ? 'is-round' : ''}`}
          style={{
            left: `${item.left}%`,
            width: `${item.size}px`,
            height: `${item.size * (item.round ? 1 : 1.6)}px`,
            background: item.color,
            animationDelay: `${item.delay}s`,
            animationDuration: `${item.duration}s`,
            '--drift': `${item.drift}px`,
            '--spin': `${item.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}

// A single reusable overlay for every celebration tier. `kind` decides the copy
// and the icon so the three call sites stay thin.
export default function Celebration({ kind, milestone, habitName, completed, total, streak, reward, effects = true, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const isMilestone = kind === 'milestone'
  const heading = isMilestone ? `${milestone}-day streak!` : 'Today complete!'
  const message = isMilestone
    ? `You've unlocked ${milestoneLabel(milestone)}. Consistency compounds — keep going.`
    : `You completed all ${total} ${total === 1 ? 'habit' : 'habits'} for today. Your streak continues.`

  return (
    <div className="modal-backdrop celebration-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={heading}>
      {effects && <Confetti pieces={isMilestone ? 70 : 48} />}
      <div className={`celebration ${visible ? 'is-visible' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className={`celebration-badge ${isMilestone ? 'is-gold' : 'is-green'}`}>
          {isMilestone ? <Trophy size={30} /> : <PartyPopper size={30} />}
        </div>
        <p className="eyebrow">{isMilestone ? <><Sparkles size={14} /> Milestone unlocked</> : <><Check size={14} /> All done for today</>}</p>
        <h2>{heading}</h2>
        <p className="celebration-copy">{message}</p>

        {!isMilestone && (
          <div className="celebration-stats">
            <span><strong>{completed}</strong> completed</span>
            <span><Flame size={14} /><strong>{streak}</strong> day streak</span>
          </div>
        )}

        {reward && (
          <div className="celebration-reward">
            <Sparkles size={15} />
            <div>
              <strong>Reward unlocked</strong>
              <small>{reward.name}</small>
            </div>
          </div>
        )}

        {habitName && <p className="celebration-habit">Last check-off: {habitName}</p>}

        <button className="primary-button full" onClick={onClose}>Keep going</button>
      </div>
    </div>
  )
}
