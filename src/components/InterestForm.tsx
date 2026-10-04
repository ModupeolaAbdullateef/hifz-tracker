import { useState } from 'react'
import { ErrorBanner, SuccessBanner } from './LoadingAndEmpty'
import { submitInterest } from '../lib/api'
import type { InterestFor } from '../lib/types'

const emptyForm = { fullName: '', email: '', phone: '', interestedFor: 'myself' as InterestFor, message: '', website: '' }

export default function InterestForm() {
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Honeypot: real people never see or fill the "website" field.
    if (form.website) {
      setDone(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await submitInterest({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        interestedFor: form.interestedFor,
        message: form.message.trim(),
      })
      setDone(true)
      setForm(emptyForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div>
        <SuccessBanner text="JazakAllahu khayran — we've received your details and the admin will be in touch soon." />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDone(false)}>
          Send another enquiry
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="interest-form">
      <div className="interest-form__row">
        <div className="field">
          <label htmlFor="if-name">Full name</label>
          <input
            id="if-name"
            type="text"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            required
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="if-email">Email</label>
          <input
            id="if-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
            maxLength={200}
            autoComplete="email"
          />
        </div>
      </div>
      <div className="interest-form__row">
        <div className="field">
          <label htmlFor="if-phone">Phone (optional)</label>
          <input
            id="if-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            maxLength={40}
            autoComplete="tel"
          />
        </div>
        <div className="field">
          <label htmlFor="if-for">The place is for</label>
          <select id="if-for" value={form.interestedFor} onChange={(e) => set('interestedFor', e.target.value as InterestFor)}>
            <option value="myself">Myself</option>
            <option value="my_child">My child</option>
            <option value="other">Someone else</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="if-message">Message (optional)</label>
        <textarea
          id="if-message"
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          maxLength={2000}
          placeholder="E.g. age of the student, current level, any questions…"
        />
      </div>
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="if-website">Website</label>
        <input
          id="if-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => set('website', e.target.value)}
        />
      </div>
      {error && <ErrorBanner text={error} />}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Sending…' : 'Register my interest'}
      </button>
      <p className="field-hint text-center">Your details are only shared with the class admin.</p>
    </form>
  )
}
