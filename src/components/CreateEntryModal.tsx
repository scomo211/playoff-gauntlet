import { useState, FormEvent } from 'react'
import Modal from './Modal'

interface CreateEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (entryName: string) => Promise<{ error: string | null }>
}

export default function CreateEntryModal({ isOpen, onClose, onSubmit }: CreateEntryModalProps) {
  const [entryName, setEntryName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!entryName.trim()) {
      setError('Entry name is required')
      return
    }

    if (entryName.trim().length < 2) {
      setError('Entry name must be at least 2 characters')
      return
    }

    if (entryName.trim().length > 30) {
      setError('Entry name must be 30 characters or less')
      return
    }

    setLoading(true)
    const { error } = await onSubmit(entryName)
    setLoading(false)

    if (error) {
      setError(error)
    } else {
      setEntryName('')
      onClose()
    }
  }

  const handleClose = () => {
    setEntryName('')
    setError(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Entry">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="entryName" className="block text-sm font-medium text-gray-700 mb-1">
            Entry Name
          </label>
          <input
            type="text"
            id="entryName"
            value={entryName}
            onChange={(e) => setEntryName(e.target.value)}
            placeholder="e.g., Team Mahomes, YOLO Entry"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            autoFocus
          />
          <p className="mt-1 text-sm text-gray-500">
            Choose a unique name for this entry
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Creating...' : 'Create Entry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
