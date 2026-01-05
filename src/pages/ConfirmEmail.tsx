import { Link, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ConfirmEmail() {
  const location = useLocation()
  const { user } = useAuth()
  const email = location.state?.email

  // If user is confirmed, redirect to dashboard
  if (user?.email_confirmed_at) {
    return <Navigate to="/dashboard" replace />
  }

  // If no email in state, redirect to signup
  if (!email) {
    return <Navigate to="/signup" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-field-900/20 via-transparent to-transparent" />

      <div className="relative max-w-md w-full space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <svg className="w-12 h-12 text-field-400" viewBox="0 0 32 32" fill="none">
              <ellipse cx="16" cy="16" rx="14" ry="9" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
              <path d="M16 9v14" stroke="#0d1117" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M13 11l3 2 3-2M13 15l3 2 3-2M13 19l3 2 3-2" stroke="#0d1117" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        <div className="card-solid p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-field-500/10 border border-field-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-field-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Check your email
          </h1>

          <p className="text-slate-400 mb-6">
            Please check your inbox at
          </p>

          <p className="text-lg font-medium text-field-400 mb-6 break-all">
            {email}
          </p>

          <p className="text-slate-400 text-sm">
            Click the confirmation link in that email to activate your account and start playing.
          </p>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-sm text-slate-500">
              Didn't receive an email?{' '}
              <Link to="/signup" className="text-field-400 hover:text-field-300 transition">
                Try again
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
