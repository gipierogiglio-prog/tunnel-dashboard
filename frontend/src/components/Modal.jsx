export default function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
