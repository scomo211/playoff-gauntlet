import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Entries from './pages/Entries'
import Lineup from './pages/Lineup'
import Players from './pages/Players'
import Rules from './pages/Rules'
import ConfirmEmail from './pages/ConfirmEmail'
import ResetPassword from './pages/ResetPassword'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminUserDetail from './pages/admin/AdminUserDetail'
import AdminEntries from './pages/admin/AdminEntries'
import AdminLineupEdit from './pages/admin/AdminLineupEdit'
import AdminTeams from './pages/admin/AdminTeams'
import AdminSettings from './pages/admin/AdminSettings'
import AdminPlayerStats from './pages/admin/AdminPlayerStats'
import TestAnimations from './pages/TestAnimations'
import ProtectedRoute from './components/ProtectedRoute'
// Salary Cap Pages
import SalaryCapDashboard from './pages/salarycap/SalaryCapDashboard'
// SalaryCapMyTeam replaced by SalaryCapOffseason during offseason
import SalaryCapTeams from './pages/salarycap/SalaryCapTeams'
import SalaryCapTeamDetail from './pages/salarycap/SalaryCapTeamDetail'
import SalaryCapFreeAgents from './pages/salarycap/SalaryCapFreeAgents'
import SalaryCapRules from './pages/salarycap/SalaryCapRules'
import SalaryCapOffseason from './pages/salarycap/SalaryCapOffseason'
import Auction from './pages/salarycap/Auction'
import AdminSalaryCapImport from './pages/admin/salarycap/AdminSalaryCapImport'
import AdminSalaryCapOffseason from './pages/admin/salarycap/AdminSalaryCapOffseason'
import AdminAuction from './pages/admin/salarycap/AdminAuction'

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <Landing />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route path="/confirm-email" element={<ConfirmEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries"
        element={
          <ProtectedRoute>
            <Entries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entry/:id/lineup"
        element={
          <ProtectedRoute>
            <Lineup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/players"
        element={
          <ProtectedRoute>
            <Players />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rules"
        element={
          <ProtectedRoute>
            <Rules />
          </ProtectedRoute>
        }
      />
      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/user/:userId"
        element={
          <ProtectedRoute>
            <AdminUserDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/entries"
        element={
          <ProtectedRoute>
            <AdminEntries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/entry/:entryId/lineup"
        element={
          <ProtectedRoute>
            <AdminLineupEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/teams"
        element={
          <ProtectedRoute>
            <AdminTeams />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/player-stats"
        element={
          <ProtectedRoute>
            <AdminPlayerStats />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute>
            <AdminSettings />
          </ProtectedRoute>
        }
      />
      {/* Salary Cap Admin Routes */}
      <Route
        path="/admin/salarycap"
        element={
          <ProtectedRoute>
            <AdminSalaryCapImport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/salarycap/offseason"
        element={
          <ProtectedRoute>
            <AdminSalaryCapOffseason />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/salarycap/auction"
        element={
          <ProtectedRoute>
            <AdminAuction />
          </ProtectedRoute>
        }
      />
      {/* Salary Cap Routes */}
      <Route
        path="/salarycap"
        element={
          <ProtectedRoute>
            <SalaryCapDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salarycap/my-team"
        element={
          <ProtectedRoute>
            <SalaryCapOffseason />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salarycap/teams"
        element={
          <ProtectedRoute>
            <SalaryCapTeams />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salarycap/team/:ownerId"
        element={
          <ProtectedRoute>
            <SalaryCapTeamDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salarycap/free-agents"
        element={
          <ProtectedRoute>
            <SalaryCapFreeAgents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salarycap/rules"
        element={
          <ProtectedRoute>
            <SalaryCapRules />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salarycap/offseason"
        element={
          <ProtectedRoute>
            <SalaryCapOffseason />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salarycap/auction"
        element={
          <ProtectedRoute>
            <Auction />
          </ProtectedRoute>
        }
      />
      {/* Test Routes */}
      <Route
        path="/test/animations"
        element={
          <ProtectedRoute>
            <TestAnimations />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
