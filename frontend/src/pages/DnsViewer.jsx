import { useState, useEffect } from 'react'
import { getDnsRecords, upsertCname, deleteDnsRecord } from '../api'
import Modal from '../components/Modal'

const ZONES = [
  { key: 'uk', name: 'devgiglio.uk' },
  { key: 'com', name: 'devgiglio.com' },
  { key: 'rex', name: 'rendafixaexplicada.com' },
]

export default function DnsViewer() {
  const [selectedZone, setSelectedZone] = useState('uk')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [subdomain, setSubdomain] = useState('')
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    loadRecords()
  }, [selectedZone])

  async function loadRecords() {
    setLoading(true)
    try {
      const data = await getDnsRecords(selectedZone)
      setRecords(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!subdomain) return
    try {
      await upsertCname(selectedZone, subdomain)
      setShowModal(false)
      setSubdomain('')
      showNotification('✅ CNAME criado/atualizado!')
      loadRecords()
    } catch (err) {
      showNotification(`❌ ${err.message}`, true)
    }
  }

  async function handleDelete(recordId) {
    if (!confirm('Excluir este registro DNS?')) return
    try {
      await deleteDnsRecord(selectedZone, recordId)
      showNotification('🗑️ Registro DNS excluído!')
      loadRecords()
    } catch (err) {
      showNotification(`❌ ${err.message}`, true)
    }
  }

  function showNotification(msg, isError = false) {
    setNotification({ msg, isError })
    setTimeout(() => setNotification(null), 3000)
  }

  const currentZone = ZONES.find(z => z.key === selectedZone)

  return (
    <div>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg ${
          notification.isError ? 'bg-red-800 text-red-100' : 'bg-green-800 text-green-100'
        }`}>
          {notification.msg}
        </div>
      )}

      {/* Zone tabs */}
      <div className="flex gap-2 mb-6">
        {ZONES.map(z => (
          <button
            key={z.key}
            onClick={() => setSelectedZone(z.key)}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedZone === z.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            🌐 {z.name}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">
          🌐 DNS Records — {currentZone?.name}
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-all"
        >
          + Add CNAME
        </button>
      </div>

      {/* Records table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-300">❌ {error}</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-gray-400">Nenhum registro DNS encontrado</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="py-3 px-4 text-left text-xs text-gray-400 uppercase">Type</th>
                <th className="py-3 px-4 text-left text-xs text-gray-400 uppercase">Name</th>
                <th className="py-3 px-4 text-left text-xs text-gray-400 uppercase">Content</th>
                <th className="py-3 px-4 text-right text-xs text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {records.map(rec => (
                <tr key={rec.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-mono ${
                      rec.type === 'CNAME' ? 'bg-blue-900/50 text-blue-300' : 'bg-yellow-900/50 text-yellow-300'
                    }`}>
                      {rec.type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-sm text-white">{rec.name}</code>
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-sm text-green-300 truncate block max-w-md">{rec.content}</code>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(rec.id)}
                      className="text-gray-400 hover:text-red-400"
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add CNAME Modal */}
      {showModal && (
        <Modal onClose={() => { setShowModal(false); setSubdomain('') }}>
          <h3 className="text-lg font-semibold text-white mb-4">➕ Add CNAME Record</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Subdomain</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value)}
                  placeholder="meu-servico"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
                  autoFocus
                />
                <span className="text-gray-500 text-sm">.{currentZone?.name}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                CNAME será apontado automaticamente pro tunnel correto
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!subdomain}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold transition-all"
              >
                Criar CNAME
              </button>
              <button
                type="button"
                onClick={() => { setShowModal(false); setSubdomain('') }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
