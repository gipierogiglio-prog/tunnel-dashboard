import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
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

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🖥️</span>
              <h1 className="text-xl font-bold text-white">Tunnel Dashboard</h1>
            </div>
            <nav className="flex gap-2">
              <NavLink to="/" icon="🏠">Dashboard</NavLink>
              <NavLink to="/ingress" icon="🔧">Ingress</NavLink>
              <NavLink to="/dns" icon="🌐">DNS</NavLink>
              <NavLink to="/logs" icon="📋">Logs</NavLink>
            </nav>
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
    </BrowserRouter>
  )
}

export default App
