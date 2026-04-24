import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem } from '../../types'
import ContentCard from '../../components/ContentCard'

export default function DesignerRevisions() {
  const [items, setItems] = useState<ContentItem[]>([])

  useEffect(() => {
    api.get<ContentItem[]>('/content?status=changes_requested').then(setItems)
  }, [])

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-xl font-semibold mb-1" style={{ color: '#1a1f3a' }}>Revisions</h1>
        <p className="text-sm mb-6" style={{ color: '#4a5280' }}>Content flagged after client feedback. Review before sending back.</p>
        <div className="space-y-2">
          {items.map(i => <ContentCard key={i.id} item={i} basePath="/designer/content" showComment />)}
          {items.length === 0 && (
            <div className="text-sm text-center py-16" style={{ color: '#8892b8' }}>No revisions pending</div>
          )}
        </div>
      </main>
    </div>
  )
}
