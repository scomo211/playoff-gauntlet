# Supabase Email Templates

Go to your Supabase dashboard > Authentication > Email Templates and update each template.

**Sender Settings:**
- Go to Authentication > Email Templates > SMTP Settings (or use Supabase's default)
- Set "Sender name" to: `Playoff Gauntlet`
- Set "Sender email" to: `reminders@playoffgauntlet.com`

Note: To use a custom sender email, you need to configure a custom SMTP provider (like Resend) in Supabase.

---

## 1. Confirm Signup (Email Verification)

**Subject:** `Verify your email for Playoff Gauntlet`

**Body:**
```html
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
      <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">Verify Your Email</p>
    </div>

    <div style="padding: 32px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Welcome to Playoff Gauntlet!
      </p>

      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Please verify your email address to complete your registration and start building your playoff lineup.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="{{ .ConfirmationURL }}"
           style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Verify Email Address
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
        If you didn't create an account, you can safely ignore this email.
      </p>
    </div>

    <div style="background-color: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        <a href="https://playoffgauntlet.com" style="color: #64748b;">playoffgauntlet.com</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Magic Link

**Subject:** `Your Playoff Gauntlet login link`

**Body:**
```html
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
      <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">Magic Link Login</p>
    </div>

    <div style="padding: 32px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hey there!
      </p>

      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Click the button below to sign in to your Playoff Gauntlet account. This link will expire in 1 hour.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="{{ .ConfirmationURL }}"
           style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Sign In to Playoff Gauntlet
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
        If you didn't request this link, you can safely ignore this email.
      </p>
    </div>

    <div style="background-color: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        <a href="https://playoffgauntlet.com" style="color: #64748b;">playoffgauntlet.com</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Reset Password

**Subject:** `Reset your Playoff Gauntlet password`

**Body:**
```html
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
      <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">Password Reset</p>
    </div>

    <div style="padding: 32px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hey there!
      </p>

      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        We received a request to reset your password. Click the button below to choose a new password.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="{{ .ConfirmationURL }}"
           style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Reset Password
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>

    <div style="background-color: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        <a href="https://playoffgauntlet.com" style="color: #64748b;">playoffgauntlet.com</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 4. Invite User (if used)

**Subject:** `You're invited to Playoff Gauntlet`

**Body:**
```html
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
      <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">You're Invited!</p>
    </div>

    <div style="padding: 32px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Welcome to Playoff Gauntlet!
      </p>

      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        You've been invited to join the ultimate NFL playoff fantasy experience. Click below to set up your account and start building your lineup.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="{{ .ConfirmationURL }}"
           style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
      </div>
    </div>

    <div style="background-color: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        <a href="https://playoffgauntlet.com" style="color: #64748b;">playoffgauntlet.com</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 5. Change Email Address (if used)

**Subject:** `Confirm your new email for Playoff Gauntlet`

**Body:**
```html
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
      <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">Email Change Confirmation</p>
    </div>

    <div style="padding: 32px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hey there!
      </p>

      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Please confirm your new email address by clicking the button below.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="{{ .ConfirmationURL }}"
           style="display: inline-block; background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Confirm New Email
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
        If you didn't request this change, please contact us immediately.
      </p>
    </div>

    <div style="background-color: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        <a href="https://playoffgauntlet.com" style="color: #64748b;">playoffgauntlet.com</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## Setting Up Custom SMTP (for custom sender address)

To send from `reminders@playoffgauntlet.com`, you need to configure Supabase to use Resend as your SMTP provider:

1. Go to Supabase Dashboard > Project Settings > Authentication
2. Scroll to "SMTP Settings"
3. Enable "Custom SMTP"
4. Enter these settings:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** Your Resend API key
   - **Sender email:** `reminders@playoffgauntlet.com`
   - **Sender name:** `Playoff Gauntlet`

Make sure your domain `playoffgauntlet.com` is verified in Resend.
