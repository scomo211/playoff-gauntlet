import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useIsAdmin } from '../hooks/useAdmin'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth()
  const { isAdmin } = useIsAdmin()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/players', label: 'Players' },
    { path: '/rules', label: 'Rules' },
  ]

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-2.5">
                <svg className="w-7 h-7 text-field-400" viewBox="0 0 32 32" fill="none">
                  <ellipse cx="16" cy="16" rx="14" ry="9" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
                  <path d="M16 9v14" stroke="#1a1f2e" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M13 11l3 2 3-2M13 15l3 2 3-2M13 19l3 2 3-2" stroke="#1a1f2e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-base font-bold text-white tracking-tight">Playoff Gauntlet</span>
              </Link>
              <div className="hidden sm:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isActive(link.path)
                        ? 'text-white bg-slate-800'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-gold-400 hover:bg-gold-500/10 transition"
                >
                  Admin
                </Link>
              )}
              <div className="hidden sm:block text-sm text-slate-400">
                {user?.user_metadata?.display_name || user?.email}
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="sm:hidden border-t border-slate-800">
          <div className="flex justify-around py-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 text-sm font-medium transition ${
                  isActive(link.path)
                    ? 'text-white'
                    : 'text-slate-500'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
