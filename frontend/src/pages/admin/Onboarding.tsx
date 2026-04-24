import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { Loader2, CheckCircle } from 'lucide-react'

export default function AdminOnboarding() {
  const [brandKey, setBrandKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brandKey.trim()) return
    setSubmitting(true)
    setResult(null)
    try {
      await api.post(`/brands/${brandKey.trim()}/onboard`)
      setResult('success')
    } catch {
      setResult('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 p-8 max-w-2xl">
        <h1 className="text-xl font-semibold text-primary mb-2">Brand Onboarding</h1>
        <p className="text-sm text-muted mb-8">Trigger Instagram brand analysis for a configured brand key.</p>

        <div className="bg-white border border-border rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-primary mb-1.5">Brand Key</label>
              <input
                value={brandKey}
                onChange={e => setBrandKey(e.target.value)}
                placeholder="mbc or mc"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted mt-1.5">Must match a key in config/brands.json</p>
            </div>
            {result === 'success' && (
              <div className="flex items-center gap-2 text-success text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                <CheckCircle size={15} />
                Onboarding started — Instagram analysis running in background.
              </div>
            )}
            {result === 'error' && (
              <div className="text-danger text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                Brand not found or onboarding failed. Check the brand key.
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !brandKey.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              Start Onboarding Analysis
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
