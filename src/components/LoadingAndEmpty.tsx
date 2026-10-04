export function LoadingState({ text = 'Loading…' }: { text?: string }) {
  return <div className="loading-state">{text}</div>
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>
}

export function ErrorBanner({ text }: { text: string }) {
  return <div className="error-banner">{text}</div>
}

export function SuccessBanner({ text }: { text: string }) {
  return <div className="success-banner">{text}</div>
}
