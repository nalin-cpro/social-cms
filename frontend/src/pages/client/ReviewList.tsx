import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { ContentItem } from '../../types'
import ContentCard from '../../components/ContentCard'

export default function ClientReviewList() {
  const [items, setItems] = useState<ContentItem[]>([])

  useEffect(() => {
    api.get<ContentItem[]>('/content?status=ready_for_approval').then(setItems)
  }, [])

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-xl font-semibold mb-1" style={{ color: '#1a1f3a' }}>Content for Review</h1>
        <p className="text-sm mb-6" style={{ color: '#4a5280' }}>Review and approve content before it goes live.</p>
        <div className="space-y-2">
          {items.map(i => <ContentCard key={i.id} item={i} basePath="/client/review" />)}
          {items.length === 0 && (
            <div className="text-sm text-center py-16" style={{ color: '#8892b8' }}>No content ready for review</div>
          )}
        </div>
      </main>
    </div>
  )
}
