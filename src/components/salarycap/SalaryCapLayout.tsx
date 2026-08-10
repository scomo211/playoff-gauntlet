import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useIsAdmin } from '../../hooks/useAdmin'
import { useIsSalaryCapOwner } from '../../hooks/useSalaryCap'

interface SalaryCapLayoutProps {
  children: React.ReactNode
}

export default function SalaryCapLayout({ children }: SalaryCapLayoutProps) {
  const { user, signOut } = useAuth()
  const { isAdmin } = useIsAdmin()
  const { isOwner } = useIsSalaryCapOwner()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  const navLinks = [
    { path: '/salarycap', label: 'Dashboard' },
    ...(isOwner ? [{ path: '/salarycap/my-team', label: 'My Team' }] : []),
    { path: '/salarycap/auction', label: 'Auction' },
    { path: '/salarycap/free-agents', label: 'Free Agents' },
    { path: '/salarycap/rules', label: 'Rules' },
  ]

  return (
    <div className="min-h-screen bg-base">
      <nav className="bg-surface-panel border-b border-hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-[56px]">
            {/* Left: Logo + Nav Links */}
            <div className="flex items-center gap-8">
              <Link to="/salarycap" className="flex items-center gap-[10px]">
                <div className="w-[30px] h-[30px] bg-field-500 rounded-[9px] flex items-center justify-center font-data font-bold text-[15px] text-[#04150c]">
                  $
                </div>
                <div className="flex flex-col">
                  <span className="font-display font-bold text-[15px] text-fg tracking-[-0.01em] leading-tight">
                    Salary Cap
                  </span>
                  <span className="font-data text-[9.5px] text-fg-subtle tracking-[0.04em]">
                    Bobby 3-Stix Memorial
                  </span>
                </div>
              </Link>
              <div className="hidden sm:flex items-center gap-[4px]">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-[12px] py-[7px] rounded-[8px] text-[13px] font-semibold transition ${
                      isActive(link.path)
                        ? 'text-fg bg-surface-well'
                        : 'text-fg-muted hover:text-fg hover:bg-surface-well/50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: Playoff Gauntlet + Admin + User + Sign out */}
            <div className="flex items-center gap-[10px]">
              <Link
                to="/dashboard"
                className="px-[12px] py-[7px] rounded-[8px] text-[13px] font-semibold text-[#60a5fa] hover:bg-[#60a5fa]/10 transition"
              >
                Playoff Gauntlet
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/salarycap"
                  className="px-[12px] py-[7px] rounded-[8px] text-[13px] font-semibold text-gold-500 hover:bg-gold-500/10 transition"
                >
                  Admin
                </Link>
              )}
              <div className="hidden sm:block font-data text-[12px] text-fg-subtle">
                {user?.user_metadata?.display_name || user?.email}
              </div>
              <button
                onClick={handleSignOut}
                className="hidden sm:block px-[12px] py-[7px] rounded-[8px] text-[13px] font-semibold text-fg-muted hover:text-fg hover:bg-surface-well transition"
              >
                Sign out
              </button>

              {/* Mobile hamburger menu */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden p-[8px] text-fg-muted hover:text-fg hover:bg-surface-well rounded-[8px] transition"
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
          <div className="sm:hidden border-t border-hairline bg-surface-panel">
            <div className="px-4 py-3 space-y-[4px]">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-[12px] py-[10px] rounded-[8px] text-[13px] font-semibold ${
                    isActive(link.path)
                      ? 'text-fg bg-surface-well'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-well/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-[12px] py-[10px] rounded-[8px] text-[13px] font-semibold text-[#60a5fa] hover:bg-[#60a5fa]/10"
              >
                Playoff Gauntlet
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/salarycap"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-[12px] py-[10px] rounded-[8px] text-[13px] font-semibold text-gold-500 hover:bg-gold-500/10"
                >
                  Admin
                </Link>
              )}
              <div className="border-t border-hairline pt-[10px] mt-[10px]">
                <div className="px-[12px] py-[4px] font-data text-[11px] text-fg-subtle">
                  {user?.user_metadata?.display_name || user?.email}
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    handleSignOut()
                  }}
                  className="block w-full text-left px-[12px] py-[10px] rounded-[8px] text-[13px] font-semibold text-fg-muted hover:text-fg hover:bg-surface-well/50"
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
