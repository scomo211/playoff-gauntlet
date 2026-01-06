// Format a date/time string in the user's local timezone with timezone abbreviation
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

// Format just the date (no time)
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Format a full deadline with day of week
export function formatDeadline(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

// Format a short time (for compact displays)
export function formatShortDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}
