# Playoff Gauntlet

A playoff fantasy football web app where each NFL player can only be used once across all 4 playoff weeks.

## Features

- **Multiple Entries**: Users can create unlimited entries ($25 each)
- **Once-and-Done**: Players lock after use - strategy matters!
- **Live Leaderboard**: See standings with "in the money" highlighting
- **Admin Dashboard**: Manage users, entries, payments, and team eliminations

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Hosting**: Vercel

## Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your Supabase credentials.

3. **Set up Supabase database**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Open SQL Editor
   - Run these files in order:
     1. `supabase/schema.sql`
     2. `supabase/seed.sql`
     3. `supabase/players.sql`

4. **Start dev server**
   ```bash
   npm run dev
   ```

5. **Make yourself admin**
   ```sql
   UPDATE profiles SET is_admin = true WHERE email = 'your-email@example.com';
   ```

## Deploy to Vercel

### Option 1: Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Add environment variables** (in Vercel dashboard or CLI)
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   ```

4. **Redeploy with env vars**
   ```bash
   vercel --prod
   ```

### Option 2: GitHub Integration

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/playoff-gauntlet.git
   git push -u origin main
   ```

2. **Import in Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Add environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - Deploy!

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

## Project Structure

```
playoff-gauntlet/
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts (Auth)
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Supabase client
│   ├── pages/          # Page components
│   │   └── admin/      # Admin pages
│   └── types/          # TypeScript types
├── supabase/
│   ├── schema.sql      # Database schema
│   ├── seed.sql        # Initial data (weeks, teams)
│   └── players.sql     # NFL player data
└── public/             # Static assets
```

## Admin Features

Access `/admin` (requires `is_admin = true` in profiles table)

- **Dashboard**: Stats overview, unpaid entries, missing lineups
- **Users**: View all users, grant/revoke admin access
- **Entries**: Manage entries, toggle payment status, delete entries
- **Teams**: Eliminate/reinstate playoff teams
- **Settings**: Lock entries, set current week

## Scoring System

| Category | Points |
|----------|--------|
| Passing Yards | 0.04/yard |
| Passing TD | 6 |
| Interception | -2 |
| Rushing Yards | 0.1/yard |
| Rushing TD | 6 |
| Reception | 0.5 (PPR) |
| Receiving Yards | 0.1/yard |
| Receiving TD | 6 |
| Fumble Lost | -2 |
| Field Goal | 0.1/yard |
| Extra Point | 1 |

## License

MIT
