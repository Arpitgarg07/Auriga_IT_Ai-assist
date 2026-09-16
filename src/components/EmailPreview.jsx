import { useEffect } from 'react'
import { Mail, X } from 'lucide-react'

// Renders the exact HTML the server would send, in an iframe, so the email can
// be demonstrated without configuring SMTP or sending anything to anyone.
// `sandbox` is deliberately restrictive: the document is inert markup.
export default function EmailPreview({ preview, onClose }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Email preview">
      <div className="email-preview" onMouseDown={(event) => event.stopPropagation()}>
        <div className="email-preview-head">
          <div>
            <p className="eyebrow"><Mail size={14} /> Email preview</p>
            <strong>{preview.subject}</strong>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close preview"><X size={17} /></button>
        </div>

        <ul className="email-preview-meta">
          {preview.habits?.map((habit) => (
            <li key={habit.name}>
              {habit.name}
              {habit.streak > 0 && <span>🔥 {habit.streak} day{habit.streak === 1 ? '' : 's'}</span>}
            </li>
          ))}
        </ul>

        <iframe
          className="email-preview-frame"
          title="Reminder email preview"
          sandbox=""
          srcDoc={preview.html}
        />

        <p className="muted field-hint">
          This is the real template. Nothing has been sent — previewing needs no credentials.
        </p>
      </div>
    </div>
  )
}
