import { useState } from 'react'
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/entries', label: 'My Entries' },
    { path: '/players', label: 'Players' },
    { path: '/rules', label: 'Rules' },
    { path: '/salarycap', label: 'Salary Cap', highlight: true },
  ]

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-2.5">
                <img src="/favicon.png" alt="Playoff Gauntlet" className="w-7 h-7" />
                <div className="flex flex-col">
                  <span className="text-base font-bold text-white tracking-tight leading-tight">Playoff Gauntlet</span>
                  <span className="text-[10px] text-slate-500 tracking-wide">Year 8</span>
                </div>
              </Link>
              <div className="hidden sm:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      isActive(link.path)
                        ? 'text-white bg-slate-800'
                        : link.highlight
                        ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
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
                className="hidden sm:block px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Sign out
              </button>
              {/* Mobile hamburger menu */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                {isMobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-800 bg-slate-900">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive(link.path)
                      ? 'text-white bg-slate-800'
                      : link.highlight
                      ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-gold-400 hover:bg-gold-500/10"
                >
                  Admin
                </Link>
              )}
              <div className="border-t border-slate-800 pt-2 mt-2">
                <div className="px-3 py-1 text-xs text-slate-500">
                  {user?.user_metadata?.display_name || user?.email}
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    handleSignOut()
                  }}
                  className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
