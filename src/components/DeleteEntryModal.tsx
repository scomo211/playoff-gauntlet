import { useState } from 'react'
import Modal from './Modal'
import { Entry } from '../types/database'

interface DeleteEntryModalProps {
  isOpen: boolean
  onClose: () => void
  entry: Entry | null
  onConfirm: (entryId: string) => Promise<{ error: string | null }>
}

export default function DeleteEntryModal({ isOpen, onClose, entry, onConfirm }: DeleteEntryModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!entry) return

    setError(null)
    setLoading(true)
    const { error } = await onConfirm(entry.id)
    setLoading(false)

    if (error) {
      setError(error)
    } else {
      onClose()
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  if (!entry) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete Entry">
      <div>
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-center text-slate-300">
            Are you sure you want to delete <span className="font-semibold text-white">"{entry.entry_name}"</span>?
          </p>
          <p className="text-center text-sm text-slate-500 mt-2">
            This action cannot be undone. All lineup data for this entry will be permanently deleted.
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
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center px-5 py-2.5 font-semibold text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting...' : 'Delete Entry'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
