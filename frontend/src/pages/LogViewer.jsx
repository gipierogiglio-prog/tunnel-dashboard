import { useState } from 'react'
import { getLogs } from '../api'

const TUNNEL_KEYS = ['uk', 'com', 'rex']
const TUNNEL_NAMES = {
  uk: 'devgiglio-uk',
  com: 'devgiglio-com',
  rex: 'rendafixaexplicada',
}

export default function LogViewer() {
  const [selectedTunnel, setSelectedTunnel] = useState('uk')
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function loadLogs() {
    setLoading(true)
    setError(null)
    try {
      const data = await getLogs(selectedTunnel)
      setLogs(data.logs)
    } catch (err) {
      setError(err.message)
      setLogs('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Tunnel selector */}
      <div className="flex gap-2 mb-6">
        {TUNNEL_KEYS.map(key => (
          <button
            key={key}
            onClick={() => { setSelectedTunnel(key); setLogs(''); setError(null) }}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedTunnel === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            📋 {TUNNEL_NAMES[key]}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">
          📋 Logs — {TUNNEL_NAMES[selectedTunnel]}
        </h2>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-all"
        >
          {loading ? '🔄 Carregando...' : '📥 Fetch Logs'}
        </button>
      </div>

      {/* Log viewer */}
      {error ? (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-300">❌ {error}</p>
        </div>
      ) : logs ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap overflow-auto max-h-[70vh]">
            {logs}
          </pre>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-gray-400">
            Clique em "Fetch Logs" para carregar as últimas 50 linhas do journalctl
          </p>
        </div>
      )}
    </div>
  )
}
