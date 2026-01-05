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
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-red-100 mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-center text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">"{entry.entry_name}"</span>?
          </p>
          <p className="text-center text-sm text-gray-500 mt-2">
            This action cannot be undone. All lineup data for this entry will be permanently deleted.
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
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Deleting...' : 'Delete Entry'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
