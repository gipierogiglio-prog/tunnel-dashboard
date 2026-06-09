import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { setCredentials, loadCredentials, clearCredentials, getCredentials } from './api'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import IngressEditor from './pages/IngressEditor'
import DnsViewer from './pages/DnsViewer'
import LogViewer from './pages/LogViewer'

function NavLink({ to, children, icon }) {
  const location = useLocation()
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <span>{icon}</span>
      <span>{children}</span>
    </Link>
  )
}

function AppLayout({ onLogout }) {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🖥️</span>
            <h1 className="text-xl font-bold text-white">Tunnel Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex gap-2">
              <NavLink to="/" icon="🏠">Dashboard</NavLink>
              <NavLink to="/ingress" icon="🔧">Ingress</NavLink>
              <NavLink to="/dns" icon="🌐">DNS</NavLink>
              <NavLink to="/logs" icon="📋">Logs</NavLink>
            </nav>
            <button
              onClick={onLogout}
              className="px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
              title="Sair"
            >
              🚪 Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ingress" element={<IngressEditor />} />
          <Route path="/ingress/:tunnelId" element={<IngressEditor />} />
          <Route path="/dns" element={<DnsViewer />} />
          <Route path="/logs" element={<LogViewer />} />
        </Routes>
      </main>
    </div>
  )
}

function AppContent() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loadCredentials()) {
      setAuthenticated(true)
    }
    setLoading(false)
  }, [])

  function handleLogin(credentials) {
    setCredentials(credentials)
    setAuthenticated(true)
  }

  function handleLogout() {
    clearCredentials()
    setAuthenticated(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin text-4xl">🔄</div>
      </div>
    )
  }

  if (!authenticated) {
    return <Login onLogin={handleLogin} />
  }

  return <AppLayout onLogout={handleLogout} />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
