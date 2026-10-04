import { useState } from 'react'
import { ErrorBanner } from './LoadingAndEmpty'
import { formatUKDate } from '../lib/dates'
import type { RecordField, RecordValues, WeeklyRecord } from '../lib/types'

export interface RecordEditSheetProps {
  studentLabel: string
  weekNumber: number
  weekDate: string
  fields: RecordField[]
  existingRecord?: WeeklyRecord
  onClose: () => void
  onSave: (data: {
    status: 'present' | 'absent'
    goodWeek: boolean
    values: RecordValues
    note: string | null
    nextAssignment: string | null
  }) => Promise<void>
  onSaveAndNext?: (data: {
    status: 'present' | 'absent'
    goodWeek: boolean
    values: RecordValues
    note: string | null
    nextAssignment: string | null
  }) => Promise<void>
}

export default function RecordEditSheet({
  studentLabel,
  weekNumber,
  weekDate,
  fields,
  existingRecord,
  onClose,
  onSave,
  onSaveAndNext,
}: RecordEditSheetProps) {
  const [status, setStatus] = useState<'present' | 'absent'>(existingRecord?.status ?? 'present')
  const [goodWeek, setGoodWeek] = useState(existingRecord?.good_week ?? false)
  const [values, setValues] = useState<RecordValues>(existingRecord?.values ?? {})
  const [note, setNote] = useState(existingRecord?.note ?? '')
  const [nextAssignment, setNextAssignment] = useState(existingRecord?.next_assignment ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'next' | null>(null)

  function setFieldValue(key: string, value: number | boolean | null) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function buildPayload() {
    return {
      status,
      goodWeek,
      values: status === 'absent' ? {} : values,
      note: note.trim() ? note.trim() : null,
      nextAssignment: nextAssignment.trim() ? nextAssignment.trim() : null,
    }
  }

  async function handleSave() {
    setBusy('save')
    setError(null)
    try {
      await onSave(buildPayload())
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this record.')
    } finally {
      setBusy(null)
    }
  }

  async function handleSaveAndNext() {
    if (!onSaveAndNext) return
    setBusy('next')
    setError(null)
    try {
      await onSaveAndNext(buildPayload())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this record.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__header">
          <h3 className="mt-0">
            {studentLabel} &middot; Week {weekNumber}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted">{formatUKDate(weekDate)}</p>

        {existingRecord && (
          <p className="field-hint">
            Last edited by {existingRecord.updated_by ?? 'unknown'} on{' '}
            {new Date(existingRecord.updated_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
          </p>
        )}

        <div className="field">
          <label>Attendance</label>
          <div className="toggle-group">
            <button
              type="button"
              data-variant="good"
              className={status === 'present' ? 'is-active' : ''}
              onClick={() => setStatus('present')}
            >
              Present
            </button>
            <button
              type="button"
              data-variant="absent"
              className={status === 'absent' ? 'is-active' : ''}
              onClick={() => setStatus('absent')}
            >
              Absent
            </button>
          </div>
        </div>

        {status === 'present' && (
          <>
            {fields.map((field) => (
              <div className="field" key={field.key}>
                <label htmlFor={`f-${field.key}`}>
                  {field.label} {field.unit && `(${field.unit})`}
                </label>
                {field.type === 'number' ? (
                  <input
                    id={`f-${field.key}`}
                    type="number"
                    step={0.01}
                    inputMode="decimal"
                    value={typeof values[field.key] === 'number' ? (values[field.key] as number) : ''}
                    onChange={(e) =>
                      setFieldValue(field.key, e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                ) : (
                  <div className="toggle-group">
                    <button
                      type="button"
                      data-variant="yes"
                      className={values[field.key] === true ? 'is-active' : ''}
                      onClick={() => setFieldValue(field.key, true)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      data-variant="no"
                      className={values[field.key] === false ? 'is-active' : ''}
                      onClick={() => setFieldValue(field.key, false)}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            ))}

            <div className="field">
              <label className="switch">
                <input type="checkbox" checked={goodWeek} onChange={(e) => setGoodWeek(e.target.checked)} />
                <span className="switch__track" />
                Good week
              </label>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="note">Note</label>
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="next">Next assignment</label>
          <textarea id="next" value={nextAssignment} onChange={(e) => setNextAssignment(e.target.value)} />
        </div>

        {error && <ErrorBanner text={error} />}

        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-primary" onClick={handleSave} disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
          {onSaveAndNext && (
            <button className="btn btn-secondary" onClick={handleSaveAndNext} disabled={busy !== null}>
              {busy === 'next' ? 'Saving…' : 'Save & next student'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose} disabled={busy !== null}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
