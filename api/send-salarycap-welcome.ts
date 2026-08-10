import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY

interface Owner {
  name: string
  email: string
  hasAccount: boolean
}

const OWNERS: Owner[] = [
  // Existing account holders
  { name: 'Brad Wandell', email: 'wandell.brad@gmail.com', hasAccount: true },
  { name: 'Rob Green', email: 'rgreen0789@yahoo.com', hasAccount: true },
  { name: 'Josh Sacks', email: 'joshuasacks1@gmail.com', hasAccount: true },
  { name: 'Scott Moran', email: 'scotty.moran@gmail.com', hasAccount: true },
  { name: 'Tim Meyers', email: 'timothykmeyers@gmail.com', hasAccount: true },
  { name: 'Tyler Bulger', email: 'tybulger@gmail.com', hasAccount: true },
  { name: 'Zach Moore', email: 'zachmoore12@gmail.com', hasAccount: true },
  // New users who need to create accounts
  { name: 'Brent Alexander', email: 'brent0530@gmail.com', hasAccount: false },
  { name: 'Johnny Goodwin', email: 'jonny.goodwin@gmail.com', hasAccount: false },
  { name: 'Nick Meyer', email: 'coach.meyer.chop@gmail.com', hasAccount: false },
  { name: 'Nick Scott', email: 'scottnw36@gmail.com', hasAccount: false },
  { name: 'Ryan Hossick', email: 'rhossick@gmail.com', hasAccount: false },
]

function generateExistingUserEmail(name: string): string {
  const firstName = name.split(' ')[0]
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
      <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">Salary Cap League</p>
    </div>

    <div style="padding: 32px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hey ${firstName},
      </p>

      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        The Salary Cap module is now live on Playoff Gauntlet! You can view your roster, make offseason decisions, and prepare for the upcoming auction draft.
      </p>

      <div style="background-color: #0f172a; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="color: #a7f3d0; font-weight: 600; margin: 0 0 12px 0;">What you can do now:</p>
        <ul style="color: #e2e8f0; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>View your current roster and contract details</li>
          <li>Make offseason decisions (keep, franchise tag, or release players)</li>
          <li>Browse available free agents</li>
          <li>Check out other teams' rosters</li>
          <li>Let us know your availability for the draft</li>
        </ul>
      </div>

      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Since you already have a Playoff Gauntlet account, just log in and you'll have access to the Salary Cap pages.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://playoffgauntlet.com/salarycap"
           style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Your Team
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
        Let's have a great season!
      </p>
    </div>

    <div style="background-color: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        You're receiving this because you're a member of the Salary Cap league.<br>
        <a href="https://playoffgauntlet.com" style="color: #64748b;">playoffgauntlet.com</a>
      </p>
    </div>
  </div>
</body>
</html>
`
}

function generateNewUserEmail(name: string): string {
  const firstName = name.split(' ')[0]
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
      <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">Salary Cap League</p>
    </div>

    <div style="padding: 32px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hey ${firstName},
      </p>

      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        The Salary Cap module is now live on Playoff Gauntlet! You can view your roster, make offseason decisions, and prepare for the upcoming auction draft.
      </p>

      <div style="background-color: #0f172a; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="color: #a7f3d0; font-weight: 600; margin: 0 0 12px 0;">What you can do now:</p>
        <ul style="color: #e2e8f0; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>View your current roster and contract details</li>
          <li>Make offseason decisions (keep, franchise tag, or release players)</li>
          <li>Browse available free agents</li>
          <li>Check out other teams' rosters</li>
          <li>Let us know your availability for the draft</li>
        </ul>
      </div>

      <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="color: #92400e; font-weight: 600; margin: 0 0 12px 0;">Create Your Account</p>
        <p style="color: #78350f; margin: 0; font-size: 14px; line-height: 1.6;">
          To access the Salary Cap pages, you'll need to create a Playoff Gauntlet account. Click the button below and sign up using this email address (<strong>${OWNERS.find(o => o.name === name)?.email}</strong>) so we can link your account to your team.
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://playoffgauntlet.com/salarycap"
           style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Create Account & View Your Team
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
        Let's have a great season!
      </p>
    </div>

    <div style="background-color: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        You're receiving this because you're a member of the Salary Cap league.<br>
        <a href="https://playoffgauntlet.com" style="color: #64748b;">playoffgauntlet.com</a>
      </p>
    </div>
  </div>
</body>
</html>
`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify authorization
  const authHeader = req.headers.authorization
  const apiKey = req.query.key || req.headers['x-api-key']
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    apiKey === process.env.CRON_SECRET

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Missing RESEND_API_KEY' })
  }

  const resend = new Resend(RESEND_API_KEY)

  // Optional: send to specific email only (for testing)
  const testEmail = req.query.email as string | undefined
  const dryRun = req.query.dry === 'true'

  const results: { email: string; status: 'sent' | 'error' | 'skipped'; error?: string }[] = []

  for (const owner of OWNERS) {
    // If test email specified, only send to that email
    if (testEmail && owner.email !== testEmail) {
      continue
    }

    if (dryRun) {
      results.push({ email: owner.email, status: 'skipped' })
      continue
    }

    try {
      const html = owner.hasAccount
        ? generateExistingUserEmail(owner.name)
        : generateNewUserEmail(owner.name)

      await resend.emails.send({
        from: 'Playoff Gauntlet <reminders@playoffgauntlet.com>',
        to: owner.email,
        subject: 'Salary Cap League is Live!',
        html
      })

      results.push({ email: owner.email, status: 'sent' })
    } catch (err) {
      results.push({
        email: owner.email,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  const sent = results.filter(r => r.status === 'sent').length
  const errors = results.filter(r => r.status === 'error')

  return res.status(200).json({
    success: true,
    sent,
    total: OWNERS.length,
    results,
    errors: errors.length > 0 ? errors : undefined
  })
}
