import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

interface Week {
  id: number
  name: string
  lockout_time: string
  is_current: boolean
}

interface Entry {
  id: string
  entry_name: string
  user_id: string
  is_submitted: boolean
}

interface UserEntries {
  email: string
  display_name: string
  entries: { name: string; submitted: boolean }[]
}

async function supabaseQuery(path: string, options: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY!,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Supabase error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

function generateEmailHtml(
  displayName: string,
  entries: { name: string; submitted: boolean }[],
  hoursRemaining: number,
  weekName: string
): string {
  const unsubmittedEntries = entries.filter(e => !e.submitted)
  const submittedEntries = entries.filter(e => e.submitted)

  const unsubmittedList = unsubmittedEntries.length > 0
    ? `<div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #dc2626; font-weight: 600; margin: 0 0 8px 0;">Needs submission:</p>
        <ul style="margin: 0; padding-left: 20px; color: #7f1d1d;">
          ${unsubmittedEntries.map(e => `<li>${e.name}</li>`).join('')}
        </ul>
      </div>`
    : ''

  const submittedList = submittedEntries.length > 0
    ? `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #16a34a; font-weight: 600; margin: 0 0 8px 0;">Already submitted (no action needed):</p>
        <ul style="margin: 0; padding-left: 20px; color: #14532d;">
          ${submittedEntries.map(e => `<li>${e.name}</li>`).join('')}
        </ul>
      </div>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Playoff Gauntlet</h1>
      <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">${weekName} Lineup Reminder</p>
    </div>

    <div style="padding: 32px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hey ${displayName},
      </p>

      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Lineups are now unlocked. Head into the app and submit your Superb Owl 🦉 lineup!
      </p>

      ${unsubmittedList}
      ${submittedList}

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://playoffgauntlet.com/entries"
           style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Submit Your Lineup${unsubmittedEntries.length !== 1 ? 's' : ''}
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
        Good luck this week!
      </p>
    </div>

    <div style="background-color: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        You're receiving this because you have entries in Playoff Gauntlet.<br>
        <a href="https://playoffgauntlet.com" style="color: #64748b;">playoffgauntlet.com</a>
      </p>
    </div>
  </div>
</body>
</html>
`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify authorization - accept Vercel cron secret OR our API key
  const authHeader = req.headers.authorization
  const apiKey = req.query.key || req.headers['x-api-key']
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    apiKey === process.env.CRON_SECRET ||
    req.query.test === 'true'

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Force send mode for testing (bypasses time window check)
  const forceSend = req.query.force === 'true'
  const testEmail = req.query.email as string | undefined

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  const resend = new Resend(RESEND_API_KEY)

  // Direct test mode: send a sample email to specified address
  if (testEmail) {
    try {
      const result = await resend.emails.send({
        from: 'Playoff Gauntlet <reminders@playoffgauntlet.com>',
        to: testEmail,
        subject: '24 hours to submit your lineup',
        html: generateEmailHtml(
          'Test User',
          [
            { name: 'Entry 1', submitted: false },
            { name: 'Entry 2', submitted: true },
          ],
          24,
          'Wild Card'
        )
      })
      return res.status(200).json({ success: true, testEmail, result })
    } catch (err) {
      return res.status(500).json({ error: `Failed to send test: ${err}` })
    }
  }

  try {
    // Get current week
    const weeks: Week[] = await supabaseQuery('weeks?is_current=eq.true')

    if (weeks.length === 0) {
      return res.status(200).json({ message: 'No current week found', sent: 0 })
    }

    const currentWeek = weeks[0]
    const lockoutTime = new Date(currentWeek.lockout_time)
    const now = new Date()

    // Calculate hours until lockout
    const hoursUntilLockout = (lockoutTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Determine which reminder to send (if any)
    // 24-hour reminder: between 23.5 and 24.5 hours before
    // 1-hour reminder: between 0.5 and 1.5 hours before
    let reminderType: '24h' | '1h' | 'test' = 'test'
    let hoursRemaining = Math.round(hoursUntilLockout)

    if (hoursUntilLockout >= 23.5 && hoursUntilLockout <= 24.5) {
      reminderType = '24h'
      hoursRemaining = 24
    } else if (hoursUntilLockout >= 0.5 && hoursUntilLockout <= 1.5) {
      reminderType = '1h'
      hoursRemaining = 1
    } else if (!forceSend) {
      return res.status(200).json({
        message: 'Not within reminder window',
        hoursUntilLockout: hoursUntilLockout.toFixed(2),
        sent: 0
      })
    }

    // Check if we already sent this reminder for this week (skip for test/force mode)
    if (!forceSend) {
      const existingReminders = await supabaseQuery(
        `email_reminders?week_id=eq.${currentWeek.id}&reminder_type=eq.${reminderType}`
      )

      if (existingReminders.length > 0) {
        return res.status(200).json({
          message: `${reminderType} reminder already sent for week ${currentWeek.id}`,
          sent: 0
        })
      }
    }

    // Get all entries with their lineup submission status for current week
    const entries = await supabaseQuery(`
      entries?select=id,entry_name,user_id,lineups(is_submitted)&is_active=eq.true&lineups.week_id=eq.${currentWeek.id}
    `.replace(/\s+/g, ''))

    // Get user profiles for email addresses
    const userIds = [...new Set(entries.map((e: any) => e.user_id))]

    if (userIds.length === 0) {
      return res.status(200).json({ message: 'No active entries', sent: 0 })
    }

    const profiles = await supabaseQuery(
      `profiles?select=id,email,display_name&id=in.(${userIds.map((id: string) => `"${id}"`).join(',')})`
    )

    interface Profile {
      id: string
      email: string
      display_name: string | null
    }
    const profileMap = new Map<string, Profile>(profiles.map((p: Profile) => [p.id, p]))

    // Group entries by user
    const userEntriesMap = new Map<string, UserEntries>()

    for (const entry of entries) {
      const profile = profileMap.get(entry.user_id)
      if (!profile?.email) continue

      const isSubmitted = entry.lineups?.[0]?.is_submitted || false

      if (!userEntriesMap.has(entry.user_id)) {
        userEntriesMap.set(entry.user_id, {
          email: profile.email,
          display_name: profile.display_name || 'there',
          entries: []
        })
      }

      userEntriesMap.get(entry.user_id)!.entries.push({
        name: entry.entry_name,
        submitted: isSubmitted
      })
    }

    // Filter to users who have at least one unsubmitted entry
    const usersToNotify = Array.from(userEntriesMap.values())
      .filter(user => user.entries.some(e => !e.submitted))

    if (usersToNotify.length === 0) {
      // Record that we checked but no one needed reminders (skip for test mode)
      if (!forceSend && (reminderType === '24h' || reminderType === '1h')) {
        await supabaseQuery('email_reminders', {
          method: 'POST',
          body: JSON.stringify({
            week_id: currentWeek.id,
            reminder_type: reminderType,
            emails_sent: 0,
            sent_at: new Date().toISOString()
          })
        })
      }

      return res.status(200).json({
        message: 'All lineups already submitted',
        sent: 0
      })
    }

    // Send emails
    let emailsSent = 0
    const errors: string[] = []

    for (const user of usersToNotify) {
      try {
        await resend.emails.send({
          from: 'Playoff Gauntlet <reminders@playoffgauntlet.com>',
          to: user.email,
          subject: 'Submit Your Superb Owl Lineup 🏈',
          html: generateEmailHtml(
            user.display_name,
            user.entries,
            hoursRemaining,
            currentWeek.name
          )
        })
        emailsSent++
      } catch (err) {
        errors.push(`Failed to send to ${user.email}: ${err}`)
      }
    }

    // Record that we sent this reminder (skip for test mode)
    if (!forceSend && (reminderType === '24h' || reminderType === '1h')) {
      await supabaseQuery('email_reminders', {
        method: 'POST',
        body: JSON.stringify({
          week_id: currentWeek.id,
          reminder_type: reminderType,
          emails_sent: emailsSent,
          sent_at: new Date().toISOString()
        })
      })
    }

    return res.status(200).json({
      success: true,
      reminderType,
      weekId: currentWeek.id,
      weekName: currentWeek.name,
      sent: emailsSent,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error sending reminders:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
