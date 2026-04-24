import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem } from '../../types'
import ContentCard from '../../components/ContentCard'

export default function DesignerQueue() {
  const [items, setItems] = useState<ContentItem[]>([])

  useEffect(() => { api.get<ContentItem[]>('/content').then(setItems) }, [])

  const revisions = items.filter(i => i.status === 'changes_requested')
  const pending   = items.filter(i => i.status === 'ready_for_approval')
  const other     = items.filter(i => !['changes_requested', 'ready_for_approval'].includes(i.status))

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-xl font-semibold mb-6" style={{ color: '#1a1f3a' }}>Design Queue</h1>

        {revisions.length > 0 && (
          <section className="mb-6">
            <div
              className="px-4 py-2 rounded-lg mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ background: '#fff4f3', border: '1px solid #f5c2be', color: '#b91c1c' }}
            >
              Needs Review — {revisions.length}
            </div>
            <div className="space-y-2">
              {revisions.map(i => <ContentCard key={i.id} item={i} basePath="/designer/content" showComment />)}
            </div>
          </section>
        )}

        {pending.length > 0 && (
          <section className="mb-6">
            <div
              className="px-4 py-2 rounded-lg mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ background: '#e8eeff', border: '1px solid #c7d2fe', color: '#1a2d82' }}
            >
              Pending Client Review — {pending.length}
            </div>
            <div className="space-y-2">
              {pending.map(i => <ContentCard key={i.id} item={i} basePath="/designer/content" />)}
            </div>
          </section>
        )}

        {other.length > 0 && (
          <section>
            <div
              className="px-4 py-2 rounded-lg mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ background: '#f4f6fb', border: '1px solid #dde2f0', color: '#4a5280' }}
            >
              All Other — {other.length}
            </div>
            <div className="space-y-2">
              {other.map(i => <ContentCard key={i.id} item={i} basePath="/designer/content" />)}
            </div>
          </section>
        )}

        {items.length === 0 && (
          <div className="text-sm text-center py-16" style={{ color: '#8892b8' }}>Queue is empty</div>
        )}
      </main>
    </div>
  )
}
