import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getRoutes, createRoute, updateRoute, deleteRoute } from '../api'
import Modal from '../components/Modal'

const TUNNEL_INFO = {
  uk: { name: 'devgiglio-uk', domain: 'devgiglio.uk', icon: '🏠', color: 'blue' },
  com: { name: 'devgiglio-com', domain: 'devgiglio.com', icon: '🔒', color: 'purple' },
  rex: { name: 'rendafixaexplicada', domain: 'rendafixaexplicada.com', icon: '📈', color: 'green' },
}

const TUNNEL_KEYS = ['uk', 'com', 'rex']

function RouteForm({ route, tunnelDomain, onSubmit, onCancel }) {
  // Strip domain from existing route for editing
  const initialHostname = route?.hostname && tunnelDomain && route.hostname.endsWith(`.${tunnelDomain}`)
    ? route.hostname.slice(0, -`.${tunnelDomain}`.length)
    : route?.hostname || ''
  const [hostname, setHostname] = useState(initialHostname)
  const [path, setPath] = useState(route?.path || '')
  const [service, setService] = useState(route?.service || '')

  function handleSubmit(e) {
    e.preventDefault()
    if (!hostname || !service) return
    // Append domain if not already present
    const fullHostname = tunnelDomain && !hostname.endsWith(`.${tunnelDomain}`)
      ? `${hostname}.${tunnelDomain}`
      : hostname
    onSubmit({ hostname: fullHostname, path, service })
  }

  // Strip domain from hostname if present (for editing existing routes)
  const shortHostname = hostname && tunnelDomain && hostname.endsWith(`.${tunnelDomain}`)
    ? hostname.slice(0, -`.${tunnelDomain}`.length)
    : hostname
  const fullDomain = shortHostname ? `${shortHostname}.${tunnelDomain}` : ''

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Hostname</label>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={shortHostname}
            onChange={e => setHostname(e.target.value)}
            placeholder="subdominio"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
          />
          <span className="text-gray-500 text-sm">.{tunnelDomain}</span>
        </div>
        {shortHostname && (
          <p className="text-xs text-gray-500 mt-1">→ {fullDomain}</p>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Path (opcional)</label>
        <input
          type="text"
          value={path}
          onChange={e => setPath(e.target.value)}
          placeholder="/api/*"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Service (URL interna)</label>
        <input
          type="text"
          value={service}
          onChange={e => setService(e.target.value)}
          placeholder="http://172.17.0.1:3002"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">Ex: http://172.17.0.1:3002 ou http://container-name:3000</p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={!hostname || !service}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold transition-all"
        >
          {route ? 'Salvar' : 'Adicionar Rota'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

function RouteRow({ route, tunnelDomain, onEdit, onDelete }) {
  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/50">
      <td className="py-3 px-4">
        <code className="text-sm text-blue-300">{route.hostname}</code>
        {route.path && (
          <span className="text-sm text-gray-500 ml-2">{route.path}</span>
        )}
      </td>
      <td className="py-3 px-4">
        <code className="text-sm text-green-300">{route.service}</code>
      </td>
      <td className="py-3 px-4 text-right">
        <button
          onClick={() => onEdit(route)}
          className="text-gray-400 hover:text-white mr-2"
          title="Editar"
        >
          ✏️
        </button>
        <button
          onClick={() => onDelete(route.id)}
          className="text-gray-400 hover:text-red-400"
          title="Excluir"
        >
          🗑️
        </button>
      </td>
    </tr>
  )
}

export default function IngressEditor() {
  const { tunnelId } = useParams()
  const [selectedTunnel, setSelectedTunnel] = useState(tunnelId || 'uk')
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingRoute, setEditingRoute] = useState(null)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    if (tunnelId) setSelectedTunnel(tunnelId)
  }, [tunnelId])

  useEffect(() => {
    loadRoutes()
  }, [selectedTunnel])

  async function loadRoutes() {
    setLoading(true)
    try {
      const data = await getRoutes(selectedTunnel)
      setRoutes(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const info = TUNNEL_INFO[selectedTunnel]

  async function handleCreate(data) {
    try {
      await createRoute({ tunnelId: selectedTunnel, ...data })
      setShowModal(false)
      showNotification('✅ Rota adicionada! Tunnel reiniciado com sucesso.')
      loadRoutes()
    } catch (err) {
      showNotification(`⚠️ Rota salva, mas erro ao reiniciar tunnel: ${err.message}`, true)
      loadRoutes()
    }
  }

  async function handleEdit(data) {
    try {
      await updateRoute(editingRoute.id, data)
      setEditingRoute(null)
      setShowModal(false)
      showNotification('✅ Rota atualizada! Tunnel reiniciado.')
      loadRoutes()
    } catch (err) {
      showNotification(`❌ ${err.message}`, true)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza que quer excluir esta rota?')) return
    try {
      await deleteRoute(id)
      showNotification('🗑️ Rota excluída! Tunnel reiniciado.')
      loadRoutes()
    } catch (err) {
      showNotification(`❌ ${err.message}`, true)
    }
  }

  function showNotification(msg, isError = false) {
    setNotification({ msg, isError })
    setTimeout(() => setNotification(null), 3000)
  }

  return (
    <div>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg transition-all ${
          notification.isError ? 'bg-red-800 text-red-100' : 'bg-green-800 text-green-100'
        }`}>
          {notification.msg}
        </div>
      )}

      {/* Tunnel selector tabs */}
      <div className="flex gap-2 mb-6">
        {TUNNEL_KEYS.map(key => {
          const t = TUNNEL_INFO[key]
          const isActive = selectedTunnel === key
          return (
            <button
              key={key}
              onClick={() => {
                setSelectedTunnel(key)
                window.history.replaceState(null, '', `/ingress/${key}`)
              }}
              className={`px-4 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t.icon} {t.name}
            </button>
          )
        })}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {info?.icon} {info?.name} — Ingress Rules
          </h2>
          <p className="text-sm text-gray-500">{info?.domain}</p>
        </div>
        <button
          onClick={() => { setEditingRoute(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all"
        >
          + Add Route
        </button>
      </div>

      {/* Route Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-300">❌ {error}</p>
          <button onClick={loadRoutes} className="mt-2 text-sm text-blue-400 hover:underline">
            Tentar novamente
          </button>
        </div>
      ) : routes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-gray-400">Nenhuma rota configurada para este tunnel</p>
          <p className="text-gray-600 text-sm mt-1">Clique em "Add Route" para começar</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="py-3 px-4 text-left text-xs text-gray-400 uppercase">Hostname</th>
                <th className="py-3 px-4 text-left text-xs text-gray-400 uppercase">Service</th>
                <th className="py-3 px-4 text-right text-xs text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(route => (
                <RouteRow
                  key={route.id}
                  route={route}
                  tunnelDomain={info?.domain}
                  onEdit={(r) => { setEditingRoute(r); setShowModal(true) }}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal onClose={() => { setShowModal(false); setEditingRoute(null) }}>
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingRoute ? '✏️ Editar Rota' : '➕ Nova Rota'}
          </h3>
          <RouteForm
            route={editingRoute}
            tunnelDomain={info?.domain}
            onSubmit={editingRoute ? handleEdit : handleCreate}
            onCancel={() => { setShowModal(false); setEditingRoute(null) }}
          />
        </Modal>
      )}
    </div>
  )
}
