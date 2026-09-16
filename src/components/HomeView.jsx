import { Award, CalendarCheck, Flame, Gift, Sparkles, Target, Trophy } from 'lucide-react'
import { CHALLENGE_LENGTH, MILESTONES } from '../utils/constants.js'
import { nextReward, rewardState } from '../utils/analytics.js'
import { greetingFor, motivationFor, smallWinFor } from '../utils/motivation.js'
import HabitCard from './HabitCard.jsx'
import ReminderCard from './ReminderCard.jsx'

export default function HomeView({
  name,
  todayLabel,
  todayHabits,
  onToggle,
  onEditHabit,
  onArchiveHabit,
  current,
  best,
  challenge,
  rewards,
  achievements,
  showMotivation,
  onAddReward,
  onOpenRewards,
  onNavigate,
  reminder,
  onCompleteHabit,
  onOpenReminderSettings,
}) {
  const greeting = greetingFor()
  // Counts come from the reminder view-model so the ring, the card and the
  // morning modal can never disagree about what today looks like.
  const total = reminder ? reminder.total : todayHabits.length
  const completed = reminder ? reminder.completedCount : 0
  const percent = total ? Math.round((completed / total) * 100) : 0
  const allDone = total > 0 && completed === total
  const upcoming = nextReward(rewards, best)

  return (
    <section className="page-view home-view">
      <div className="hero-head">
        <div>
          <p className="eyebrow"><Flame size={14} /> {greeting.text}</p>
          <h1>
            {greeting.text}, <em>{name}</em> {greeting.emoji}
          </h1>
          <p className="hero-sub">{todayLabel.full}</p>
          {showMotivation && (
            <p className="hero-copy">
              {/* Only a pending habit's own streak may be called "on the line".
                  The app-wide maximum (`current`) would claim a streak is at
                  risk even when its owner is already done for today. */}
              {motivationFor({ completed, total, streak: reminder?.streak?.current || 0, date: new Date() })}
            </p>
          )}
        </div>
        <div className={`today-ring ${allDone ? 'is-complete' : ''}`} style={{ '--progress': `${percent * 3.6}deg` }}>
          <div className="today-ring-inner">
            <strong>{percent}%</strong>
            <small>{completed}/{total} today</small>
          </div>
        </div>
      </div>

      <div className="quick-stats">
        <div className="quick-stat is-streak">
          <Flame size={18} />
          <strong>{current}</strong>
          <span>Current streak</span>
        </div>
        <div className="quick-stat">
          <Trophy size={18} />
          <strong>{best}</strong>
          <span>Best streak</span>
        </div>
        <div className="quick-stat">
          <CalendarCheck size={18} />
          <strong>{challenge.started ? challenge.day : '—'}</strong>
          <span>{challenge.started ? `Challenge day / ${CHALLENGE_LENGTH}` : 'Challenge not started'}</span>
        </div>
        <div className="quick-stat">
          <Target size={18} />
          <strong>{todayHabits.length}</strong>
          <span>Scheduled today</span>
        </div>
      </div>

      <ReminderCard
        reminder={reminder}
        name={name}
        onComplete={onCompleteHabit}
        onOpenSettings={onOpenReminderSettings}
      />

      <div className="hero-grid">
        <div className="challenge-panel">
          <div className="challenge-top">
            <span>{CHALLENGE_LENGTH}-day challenge</span>
            <strong>{challenge.started ? `Day ${challenge.day} / ${CHALLENGE_LENGTH}` : 'Not started'}</strong>
          </div>
          <div className="progress-track"><span style={{ width: `${challenge.percent}%` }} /></div>
          <div className="challenge-bottom">
            <span>{challenge.started ? `${challenge.remaining} days remaining` : 'Set a start date in Settings'}</span>
            <span>{challenge.percent}% complete</span>
          </div>
        </div>

        <div className="next-reward-panel">
          <p className="eyebrow"><Gift size={14} /> Next reward</p>
          {upcoming ? (
            <>
              <strong>{upcoming.name}</strong>
              <div className="mini-track"><span style={{ width: `${Math.min(100, Math.round((best / upcoming.milestone) * 100))}%` }} /></div>
              <small>{upcoming.milestone - best} more {upcoming.milestone - best === 1 ? 'day' : 'days'} at a {upcoming.milestone}-day streak</small>
            </>
          ) : (rewards || []).length ? (
            <>
              <strong>All rewards unlocked</strong>
              <small>Every reward is earned or claimed. Time to set a bigger one.</small>
            </>
          ) : (
            <>
              <strong>No rewards yet</strong>
              <small>Give yourself something to work toward.</small>
            </>
          )}
          <div className="next-reward-actions">
            <button className="secondary-button" onClick={onOpenRewards}>View rewards</button>
            <button className="text-button" onClick={onAddReward}>Add reward</button>
          </div>
        </div>
      </div>

      {allDone && (
        <div className="all-done-banner">
          <Sparkles size={18} />
          <div>
            <strong>Today is complete</strong>
            <small>All {total} scheduled {total === 1 ? 'habit' : 'habits'} checked off for {todayLabel.full}.</small>
          </div>
        </div>
      )}

      <div className="section-heading">
        <div>
          <p className="eyebrow">Your focus</p>
          <h2>Today&apos;s habits <span>{completed}/{total}</span></h2>
        </div>
        <span className="today-percent">{percent}% done</span>
      </div>

      {total ? (
        <div className="today-list">
          {todayHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              date={todayLabel.key}
              onToggle={(item) => onToggle(item, smallWinFor(completed))}
              onEdit={onEditHabit}
              onArchive={onArchiveHabit}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Target size={26} />
          <h3>Nothing scheduled today</h3>
          <p>No habits are due on {todayLabel.full}. Add one with a different schedule, or enjoy the rest.</p>
          <button className="primary-button" onClick={() => onNavigate('manage')}>Manage habits</button>
        </div>
      )}

      <div className="section-heading achievements-heading">
        <div>
          <p className="eyebrow"><Award size={14} /> Milestones</p>
          <h2>Streak badges</h2>
        </div>
      </div>
      <div className="badge-strip">
        {MILESTONES.map((milestone) => {
          const earned = (achievements || []).includes(milestone)
          const unlockedRewards = (rewards || []).filter((reward) => reward.milestone === milestone && rewardState(reward, best) !== 'locked')
          return (
            <div className={`badge ${earned ? 'earned' : ''}`} key={milestone}>
              <strong>{milestone}</strong>
              <small>{milestone === 1 ? 'start' : 'days'}</small>
              {unlockedRewards.length > 0 && <span className="badge-reward" title={unlockedRewards.map((reward) => reward.name).join(', ')}><Gift size={11} /></span>}
            </div>
          )
        })}
      </div>
      {(rewards || []).some((reward) => rewardState(reward, best) === 'unlocked') && (
        <div className="unlocked-callout">
          <Gift size={16} />
          <div>
            <strong>You have earned a reward</strong>
            <small>Claim it, then pick your next one.</small>
          </div>
          <button className="claim-button" onClick={onOpenRewards}>Go to rewards</button>
        </div>
      )}
    </section>
  )
}
