import { useState, useEffect } from 'react'
import { getTunnels, getApplyStatus, applyChanges } from '../api'

const TUNNEL_ICONS = { uk: '🏠', com: '🔒', rex: '📈' }
const STATUS_COLORS = { active: 'bg-green-500', inactive: 'bg-red-500', unknown: 'bg-gray-500' }

function TunnelCard({ tunnel, onSelect }) {
  return (
    <div
      className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-blue-500/50 transition-all cursor-pointer"
      onClick={() => onSelect(tunnel.id)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{TUNNEL_ICONS[tunnel.id]}</span>
          <div>
            <h3 className="text-lg font-semibold text-white">{tunnel.name}</h3>
            <p className="text-sm text-gray-400">{tunnel.domain}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[tunnel.status] || STATUS_COLORS.unknown}`} />
          <span className="text-sm text-gray-300 capitalize">{tunnel.status}</span>
        </div>
      </div>
      <div className="flex gap-4 text-sm text-gray-400">
        <span>📡 {tunnel.routeCount || 0} rotas</span>
        <span>🆔 {tunnel.id}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [tunnels, setTunnels] = useState([])
  const [applyStatus, setApplyStatus] = useState(null)
  const [applying, setApplying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [tunnelData, statusData] = await Promise.all([
        getTunnels(),
        getApplyStatus(),
      ])
      setTunnels(tunnelData)
      setApplyStatus(statusData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApply() {
    setApplying(true)
    try {
      await applyChanges()
      // Wait a bit and reload
      await new Promise(r => setTimeout(r, 3000))
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  function handleSelect(tunnelId) {
    window.location.href = `/ingress/${tunnelId}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin text-4xl">🔄</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-300">❌ {error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Tunnel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {tunnels.map(t => (
          <TunnelCard key={t.id} tunnel={t} onSelect={handleSelect} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={handleApply}
          disabled={applying}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-all"
        >
          {applying ? '🔄 Aplicando...' : '🔧 Apply Changes'}
        </button>
        <button
          onClick={loadData}
          className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Last Apply Status */}
      {applyStatus?.last && (
        <div className={`rounded-xl border p-4 ${
          applyStatus.last.status === 'success'
            ? 'bg-green-900/30 border-green-800'
            : applyStatus.last.status === 'failed'
            ? 'bg-red-900/30 border-red-800'
            : 'bg-yellow-900/30 border-yellow-800'
        }`}>
          <h3 className="font-semibold mb-1">Última aplicação</h3>
          <p className="text-sm text-gray-300">{applyStatus.last.message}</p>
          <p className="text-xs text-gray-500 mt-1">
            {applyStatus.last.created_at}
          </p>
        </div>
      )}
    </div>
  )
}
