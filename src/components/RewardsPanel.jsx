import { Check, Gift, Lock, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { rewardState } from '../utils/analytics.js'

const STATE_LABEL = { locked: 'Locked', unlocked: 'Unlocked', claimed: 'Claimed' }

function RewardRow({ reward, bestStreak, onEdit, onDelete, onClaim, readOnly }) {
  const state = rewardState(reward, bestStreak)
  const remaining = Math.max(0, reward.milestone - bestStreak)
  const progress = Math.min(100, Math.round((bestStreak / reward.milestone) * 100))

  return (
    <div className={`reward is-${state}`}>
      <div className="reward-icon">
        {state === 'locked' ? <Lock size={17} /> : state === 'claimed' ? <Check size={17} /> : <Gift size={17} />}
      </div>
      <div className="reward-body">
        <div className="reward-title">
          <strong>{reward.name}</strong>
          <span className={`reward-state state-${state}`}>{STATE_LABEL[state]}</span>
        </div>
        {reward.description && <p className="reward-note">{reward.description}</p>}
        <div className="reward-meta">
          <div className="mini-track"><span style={{ width: `${progress}%` }} /></div>
          <small>
            {state === 'locked'
              ? `${remaining} more ${remaining === 1 ? 'day' : 'days'} to unlock`
              : `${reward.milestone}-day milestone${state === 'claimed' ? ' · claimed' : ''}`}
          </small>
        </div>
      </div>
      {!readOnly && (
        <div className="reward-actions">
          {state === 'unlocked' && (
            <button className="claim-button" onClick={() => onClaim(reward)}>Claim</button>
          )}
          <button className="icon-button" onClick={() => onEdit(reward)} aria-label={`Edit ${reward.name}`}><Pencil size={15} /></button>
          <button className="icon-button danger" onClick={() => onDelete(reward)} aria-label={`Delete ${reward.name}`}><Trash2 size={15} /></button>
        </div>
      )}
    </div>
  )
}

export default function RewardsPanel({ rewards, bestStreak, onAdd, onEdit, onDelete, onClaim, readOnly = false, limit }) {
  const sorted = (rewards || []).slice().sort((a, b) => a.milestone - b.milestone)
  const shown = limit ? sorted.slice(0, limit) : sorted

  if (!sorted.length) {
    return (
      <div className="empty-state compact-empty">
        <Gift size={22} />
        <h3>No rewards yet</h3>
        <p>Give yourself something to aim for at a streak milestone.</p>
        {!readOnly && (
          <button className="primary-button" onClick={onAdd}><Plus size={16} /> Add reward</button>
        )}
      </div>
    )
  }

  const unlocked = sorted.filter((reward) => rewardState(reward, bestStreak) !== 'locked').length

  return (
    <div className="rewards-panel">
      <div className="reward-list">
        {shown.map((reward) => (
          <RewardRow
            key={reward.id}
            reward={reward}
            bestStreak={bestStreak}
            onEdit={onEdit}
            onDelete={onDelete}
            onClaim={onClaim}
            readOnly={readOnly}
          />
        ))}
      </div>
      {!readOnly && (
        <div className="rewards-footer">
          <small><Sparkles size={13} /> {unlocked} of {sorted.length} unlocked</small>
          <button className="secondary-button" onClick={onAdd}><Plus size={15} /> Add reward</button>
        </div>
      )}
    </div>
  )
}
