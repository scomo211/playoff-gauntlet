import { useState, FormEvent } from 'react'
import Modal from './Modal'
import { entryNameSchema, validateField } from '../lib/validation'

interface CreateEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (entryName: string) => Promise<{ error: string | null; entryId?: string }>
  onSuccess?: (entryId: string) => void
}

export default function CreateEntryModal({ isOpen, onClose, onSubmit, onSuccess }: CreateEntryModalProps) {
  const [entryName, setEntryName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validateField(entryNameSchema, entryName)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    const { error, entryId } = await onSubmit(entryName.trim())
    setLoading(false)

    if (error) {
      setError(error)
    } else {
      setEntryName('')
      onClose()
      if (entryId && onSuccess) {
        onSuccess(entryId)
      }
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
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="entryName" className="block text-sm font-medium text-slate-300 mb-1.5">
            Entry Name
          </label>
          <input
            type="text"
            id="entryName"
            value={entryName}
            onChange={(e) => setEntryName(e.target.value)}
            placeholder="e.g., Team Mahomes, YOLO Entry"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-field-500 focus:border-transparent transition"
            autoFocus
          />
          <p className="mt-1.5 text-sm text-slate-500">
            Choose a unique name for this entry
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Entry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
