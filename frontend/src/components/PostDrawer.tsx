import { useEffect, useState, useRef, useCallback } from 'react'
import {
  X, ChevronRight, Send, Check, RefreshCw, Loader2, AlertCircle,
  Store, Image as ImageIcon, Upload, ImageOff, CheckCircle2, FlaskConical,
} from 'lucide-react'
import { ContentItem, ContentComment, User } from '../types'
import { api } from '../api/client'
import StatusBadge from './StatusBadge'
import CopyPreview from './CopyPreview'

const NAVY = '#1a2d82'
const GOLD = '#f5b800'
const BASE_URL = import.meta.env.VITE_API_BASE || ''

// ── Helpers ───────────────────────────────────────────────────────────────────

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="w-full flex flex-col items-center justify-center rounded-xl gap-2"
      style={{ background: '#f4f6fb', border: '1px dashed #dde2f0', minHeight: 200 }}>
      <ImageOff size={24} style={{ color: '#dde2f0' }} />
      <p className="text-xs" style={{ color: '#8892b8' }}>{label.charAt(0).toUpperCase()} — Image coming soon</p>
    </div>
  )
}

function SafeImage({ src, alt, className, style }: {
  src: string | null | undefined; alt: string; className?: string; style?: React.CSSProperties
}) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <ImagePlaceholder label={alt} />
  const resolved = src.startsWith('/') ? `${BASE_URL}${src}` : src
  return (
    <img src={resolved} alt={alt} className={className} style={style} onError={() => setBroken(true)} />
  )
}

function CommentBubble({ comment }: { comment: ContentComment }) {
  const isTeam = comment.sender_role !== 'client'
  const time = new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = new Date(comment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
  return (
    <div className={`flex gap-2 mb-3 ${isTeam ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={isTeam ? { background: NAVY, color: '#fff' } : { background: '#f4f6fb', color: NAVY, border: '1px solid #dde2f0' }}>
        {isTeam ? 'P' : comment.sender_name.charAt(0).toUpperCase()}
      </div>
      <div className={`max-w-[75%] ${isTeam ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        <div className="px-3 py-2 rounded-xl text-sm leading-relaxed"
          style={isTeam
            ? { background: NAVY, color: '#fff', borderBottomRightRadius: 4 }
            : { background: '#f4f6fb', color: '#1a1f3a', border: '1px solid #dde2f0', borderBottomLeftRadius: 4 }}>
          {comment.message}
        </div>
        <p className="text-xs" style={{ color: '#8892b8' }}>
          {isTeam ? 'Progility' : comment.sender_name.split('@')[0]} · {dateStr} {time}
        </p>
      </div>
    </div>
  )
}

// ── Asset Library Browser ─────────────────────────────────────────────────────

interface AssetBrowserProps {
  brandKey: string
  onClose: () => void
  onUseAsIs: (asset: ContentItem) => void
  onAdapt: (asset: ContentItem, instruction: string) => void
  adapting: boolean
}

function AssetLibraryBrowser({ brandKey, onClose, onUseAsIs, onAdapt, adapting }: AssetBrowserProps) {
  const [assets, setAssets] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ContentItem | null>(null)
  const [instruction, setInstruction] = useState('')
  const [showInstruction, setShowInstruction] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get<ContentItem[]>(`/assets?brand=${brandKey}&days=90`)
      .then(setAssets)
      .catch(() => setAssets([]))
      .finally(() => setLoading(false))
  }, [brandKey])

  const filtered = assets.filter(a =>
    !search || a.product_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,26,80,0.5)' }}>
      <div className="flex flex-col rounded-xl overflow-hidden w-full max-w-2xl"
        style={{ background: '#fff', maxHeight: '90vh', border: '1px solid #dde2f0' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #dde2f0' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>Asset library</h3>
          <button onClick={onClose} className="p-1 rounded" style={{ color: '#8892b8' }}><X size={16} /></button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product name…"
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && <p className="text-xs text-center py-8" style={{ color: '#8892b8' }}>Loading assets…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: '#8892b8' }}>
              No approved photos found in the last 90 days.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {filtered.map(asset => {
              const isSelected = selected?.id === asset.id
              const src = asset.feed_post_url?.startsWith('/') ? `${BASE_URL}${asset.feed_post_url}` : asset.feed_post_url
              return (
                <button
                  key={asset.id}
                  onClick={() => { setSelected(isSelected ? null : asset); setShowInstruction(false) }}
                  className="flex flex-col rounded-lg overflow-hidden text-left transition-all"
                  style={{
                    border: isSelected ? `2px solid ${GOLD}` : '2px solid #dde2f0',
                    background: '#f4f6fb',
                  }}
                >
                  <div className="w-full" style={{ aspectRatio: '1', overflow: 'hidden', background: '#e8eeff' }}>
                    {src
                      ? <img src={src} alt={asset.product_name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageOff size={20} style={{ color: '#8892b8' }} /></div>
                    }
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" style={{ color: '#1a1f3a' }}>{asset.product_name}</p>
                    <p className="text-xs" style={{ color: '#8892b8' }}>{asset.channel}</p>
                    {isSelected && <CheckCircle2 size={12} style={{ color: GOLD, marginTop: 2 }} />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bottom bar */}
        {selected && (
          <div className="flex-shrink-0 px-5 py-4 space-y-3" style={{ borderTop: '1px solid #dde2f0' }}>
            {!showInstruction ? (
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: '#4a5280' }}>
                  <strong>1 photo selected</strong> — {selected.product_name}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUseAsIs(selected)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}
                  >
                    Use as-is
                  </button>
                  <button
                    onClick={() => setShowInstruction(true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: NAVY, color: '#fff' }}
                  >
                    Adapt with AI
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  placeholder="Tell us what to do with this image — e.g. 'replace the shoe with the Bernie Slip-On', 'use the lighting and mood but create a fresh scene', 'keep everything, just swap the product'"
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                  style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowInstruction(false)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>
                    Back
                  </button>
                  <button
                    onClick={() => onAdapt(selected, instruction)}
                    disabled={!instruction.trim() || adapting}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    style={{ background: GOLD, color: '#1a1f3a' }}
                  >
                    {adapting ? <Loader2 size={12} className="animate-spin" /> : null}
                    Generate
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Image Source Selector (3-card) ────────────────────────────────────────────

interface ImageSourceSelectorProps {
  item: ContentItem
  onUpdate: (item: ContentItem) => void
}

function ImageSourceSelector({ item, onUpdate }: ImageSourceSelectorProps) {
  const [shopifyLoading, setShopifyLoading] = useState(false)
  const [shopifyResult, setShopifyResult] = useState<{ found: boolean; image_url?: string; product_name?: string } | null>(null)
  const [assetBrowserOpen, setAssetBrowserOpen] = useState(false)
  const [adapting, setAdapting] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadUrl, setUploadUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [activeSource, setActiveSource] = useState<'shopify' | 'asset' | 'upload' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchShopify = async () => {
    setShopifyLoading(true)
    setActiveSource('shopify')
    try {
      const res = await api.post<{ found: boolean; image_url: string; product_name: string }>(
        '/pipeline/step/fetch-product',
        { content_item_id: item.id }
      )
      setShopifyResult(res)
      if (res.found) {
        const updated = await api.get<ContentItem>(`/content/${item.id}`)
        onUpdate(updated)
      }
    } catch { setShopifyResult({ found: false }) }
    finally { setShopifyLoading(false) }
  }

  const useAssetAsIs = async (asset: ContentItem) => {
    setAdapting(true)
    try {
      await api.patch<ContentItem>(`/content/${item.id}`, {
        status: item.status,
      })
      // Directly set the feed_post_url via PATCH
      const updated = await api.patch<ContentItem>(`/content/${item.id}`, {
        image_source_type: 'asset_library',
      })
      // We need to copy the asset's URL to this item
      await fetch(`${BASE_URL}/content/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ feed_post_url: asset.feed_post_url }),
      })
      const fresh = await api.get<ContentItem>(`/content/${item.id}`)
      onUpdate(fresh)
      setAssetBrowserOpen(false)
    } catch (e) { console.error(e) }
    finally { setAdapting(false) }
  }

  const adaptWithAI = async (asset: ContentItem, instruction: string) => {
    setAdapting(true)
    try {
      await api.post('/pipeline/step/generate-image-from-asset', {
        content_item_id: item.id,
        asset_content_item_id: asset.id,
        instruction,
      })
      const updated = await api.get<ContentItem>(`/content/${item.id}`)
      onUpdate(updated)
      setAssetBrowserOpen(false)
    } catch (e) { console.error(e) }
    finally { setAdapting(false) }
  }

  const handleFileUpload = async (file: File) => {
    setUploadLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const token = localStorage.getItem('token')
      const res = await fetch(
        `${BASE_URL}/assets/upload?brand_key=${item.brand_key}&content_item_id=${item.id}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
      )
      if (res.ok) {
        const updated = await api.get<ContentItem>(`/content/${item.id}`)
        onUpdate(updated)
      }
    } catch (e) { console.error(e) }
    finally { setUploadLoading(false) }
  }

  const cardStyle = (source: 'shopify' | 'asset' | 'upload') => ({
    border: `2px solid ${activeSource === source ? NAVY : '#dde2f0'}`,
    background: activeSource === source ? '#f0f3ff' : '#fff',
    borderRadius: 12,
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  return (
    <>
      <div className="space-y-3">
        {item.status === 'needs_image_source' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>
            <AlertCircle size={12} />
            Product not found in Shopify — please select an image source below.
          </div>
        )}

        {/* Card 1: Shopify */}
        <div style={cardStyle('shopify')} onClick={() => setActiveSource('shopify')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#e8eeff' }}>
              <Store size={16} style={{ color: NAVY }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#1a1f3a' }}>Shopify</p>
              <p className="text-xs" style={{ color: '#8892b8' }}>Auto-fetch from store</p>
            </div>
          </div>

          {shopifyResult && (
            <div className="mt-2 mb-2">
              {shopifyResult.found
                ? <div className="flex items-center gap-1.5 text-xs" style={{ color: '#15803d' }}>
                    <CheckCircle2 size={12} /> Product found — {shopifyResult.product_name}
                  </div>
                : <div className="text-xs" style={{ color: '#b91c1c' }}>Product not found in Shopify.</div>
              }
            </div>
          )}

          <button
            onClick={e => { e.stopPropagation(); fetchShopify() }}
            disabled={shopifyLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg mt-2 disabled:opacity-50"
            style={{ background: NAVY, color: '#fff' }}
          >
            {shopifyLoading ? <Loader2 size={11} className="animate-spin" /> : <Store size={11} />}
            {shopifyResult?.found ? 'Use this product → generate lifestyle' : 'Fetch from Shopify'}
          </button>
        </div>

        {/* Card 2: Asset library */}
        <div style={cardStyle('asset')} onClick={() => { setActiveSource('asset'); setAssetBrowserOpen(true) }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#f5f3ff' }}>
              <ImageIcon size={16} style={{ color: '#7c3aed' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#1a1f3a' }}>Asset library</p>
              <p className="text-xs" style={{ color: '#8892b8' }}>Reuse an existing approved photo</p>
            </div>
            <ChevronRight size={14} style={{ color: '#8892b8', marginLeft: 'auto' }} />
          </div>
        </div>

        {/* Card 3: Upload */}
        <div style={cardStyle('upload')} onClick={() => setActiveSource('upload')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#f0fdf4' }}>
              <Upload size={16} style={{ color: '#15803d' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#1a1f3a' }}>Upload your own</p>
              <p className="text-xs" style={{ color: '#8892b8' }}>JPG / PNG / WebP, min 1080px</p>
            </div>
          </div>

          {activeSource === 'upload' && (
            <div
              className="mt-2 flex flex-col items-center justify-center rounded-lg text-center py-6 cursor-pointer"
              style={{
                border: `2px dashed ${dragOver ? NAVY : '#dde2f0'}`,
                background: dragOver ? '#f0f3ff' : '#f4f6fb',
              }}
              onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file) handleFileUpload(file)
              }}
            >
              {uploadLoading
                ? <Loader2 size={20} className="animate-spin" style={{ color: NAVY }} />
                : <>
                    <Upload size={20} style={{ color: '#8892b8', marginBottom: 6 }} />
                    <p className="text-xs" style={{ color: '#4a5280' }}>Drop image here or click to browse</p>
                  </>
              }
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
          />
        </div>
      </div>

      {assetBrowserOpen && (
        <AssetLibraryBrowser
          brandKey={item.brand_key}
          onClose={() => setAssetBrowserOpen(false)}
          onUseAsIs={useAssetAsIs}
          onAdapt={adaptWithAI}
          adapting={adapting}
        />
      )}
    </>
  )
}

// ── Main PostDrawer ───────────────────────────────────────────────────────────

interface Props {
  item: ContentItem | null
  currentUser: User
  onClose: () => void
  onUpdate: (item: ContentItem) => void
}

type Tab = 'feed' | 'stories' | 'email'

export default function PostDrawer({ item, currentUser, onClose, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('feed')
  const [comments, setComments] = useState<ContentComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [regenInstruction, setRegenInstruction] = useState('')
  const [showRegen, setShowRegen] = useState(false)
  const [suggestionModal, setSuggestionModal] = useState<'cancel' | 'edit' | null>(null)
  const [suggestionMsg, setSuggestionMsg] = useState('')
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const isAdmin = currentUser.role === 'admin'
  const isDesigner = currentUser.role === 'designer'
  const isClient = currentUser.role === 'client'

  useEffect(() => {
    if (!item) return
    setTab(item.channel.includes('email') ? 'email' : item.channel.includes('stor') ? 'stories' : 'feed')
    setComments([])
    setCommentText('')
    setShowRegen(false)
    api.get<ContentComment[]>(`/content/${item.id}/comments`).then(setComments).catch(() => {})
  }, [item?.id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  if (!item) return null

  const doAction = async (action: string, endpoint: string, body?: Record<string, unknown>) => {
    setActionLoading(action)
    try {
      const updated = body
        ? await api.post<ContentItem>(endpoint, body)
        : await api.post<ContentItem>(endpoint)
      onUpdate(updated)
    } catch (e) { console.error(action, e) }
    finally { setActionLoading(null) }
  }

  const sendComment = async () => {
    if (!commentText.trim()) return
    setSendingComment(true)
    try {
      const comment = await api.post<ContentComment>(`/content/${item.id}/comments`, {
        message: commentText, is_internal: false,
      })
      setComments(prev => [...prev, comment])
      setCommentText('')
      if (isClient) {
        const updated = await api.get<ContentItem>(`/content/${item.id}`)
        onUpdate(updated)
      }
    } catch (e) { console.error(e) }
    finally { setSendingComment(false) }
  }

  const sendRegen = async () => {
    if (!regenInstruction.trim()) return
    setActionLoading('regen')
    try {
      const updated = await api.post<ContentItem>(`/content/${item.id}/regenerate-image`, {
        instruction: regenInstruction,
      })
      onUpdate(updated)
      setRegenInstruction('')
      setShowRegen(false)
    } catch (e) { console.error(e) }
    finally { setActionLoading(null) }
  }

  const sendSuggestion = async () => {
    if (!suggestionMsg.trim() || !suggestionModal) return
    try {
      await api.post('/suggestions', {
        content_item_id: item.id,
        suggestion_type: suggestionModal === 'cancel' ? 'cancel' : 'edit',
        message: suggestionMsg,
      })
      setSuggestionModal(null)
      setSuggestionMsg('')
    } catch (e) { console.error(e) }
  }

  const isEmail = item.channel === 'email'
  const needsSourceSelector =
    (isAdmin || isDesigner) &&
    !isEmail &&
    (item.image_source_type === 'not_set' || item.status === 'needs_image_source')

  const allTabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'feed',    label: 'Feed post', show: !isEmail },
    { id: 'stories', label: 'Stories',   show: !isEmail && item.channel !== 'tiktok' },
    { id: 'email',   label: 'Email',     show: isEmail },
  ]
  const tabs = allTabs.filter(t => t.show)

  const statusBorderColor: Record<string, string> = {
    ready_for_internal_review: '#D97706',
    changes_requested: '#DC2626',
    approved: '#16A34A',
    needs_image_source: '#E65100',
  }
  const borderColor = statusBorderColor[item.status] || 'transparent'

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(15,26,80,0.3)' }} onClick={onClose} />

      <div className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
        style={{ width: 700, background: '#fff', borderLeft: `3px solid ${borderColor || '#dde2f0'}`, boxShadow: '-4px 0 40px rgba(26,45,130,0.12)' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #dde2f0' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-base truncate" style={{ color: '#1a1f3a' }}>{item.product_name}</h2>
              <StatusBadge status={item.status} small />
            </div>
            <p className="text-xs" style={{ color: '#8892b8' }}>
              {item.channel} · {item.scheduled_date || 'No date'} · {item.campaign}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg flex-shrink-0" style={{ color: '#8892b8' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex px-6 pt-3 gap-1 flex-shrink-0">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={tab === t.id ? { background: NAVY, color: '#fff' } : { color: '#4a5280' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* Image source selector or normal image display */}
          {tab === 'feed' && !isEmail && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#8892b8' }}>
                {needsSourceSelector ? 'Image source' : 'Feed Post'}
              </p>
              {needsSourceSelector
                ? <ImageSourceSelector item={item} onUpdate={onUpdate} />
                : <SafeImage src={item.feed_post_url} alt={item.product_name}
                    className="w-full rounded-xl object-cover" style={{ maxHeight: 320 }} />
              }
              {!needsSourceSelector && item.qc_score != null && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs" style={{ color: '#8892b8' }}>QC Score</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: item.qc_score >= 7 ? '#f0fdf4' : '#fff8e0', color: item.qc_score >= 7 ? '#15803d' : '#92400e' }}>
                    {item.qc_score}/10
                  </span>
                </div>
              )}
            </div>
          )}

          {tab === 'stories' && !isEmail && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#8892b8' }}>Stories</p>
              <div className="grid grid-cols-2 gap-3">
                <SafeImage src={item.story_1_url} alt="Story 1"
                  className="w-full rounded-xl object-cover" style={{ aspectRatio: '9/16', maxHeight: 280 }} />
                <SafeImage src={item.story_2_url} alt="Story 2"
                  className="w-full rounded-xl object-cover" style={{ aspectRatio: '9/16', maxHeight: 280 }} />
              </div>
            </div>
          )}

          {(tab === 'email' || isEmail) && (
            <div className="rounded-xl p-4" style={{ background: '#f4f6fb', border: '1px solid #dde2f0' }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={14} style={{ color: '#8892b8' }} />
                <p className="text-xs" style={{ color: '#8892b8' }}>Email content — no image preview.</p>
              </div>
              {item.copy_json?.subject_lines && (
                <div className="mb-2">
                  <p className="text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Subject lines</p>
                  {item.copy_json.subject_lines.map((s: string, i: number) => (
                    <p key={i} className="text-sm" style={{ color: '#1a1f3a' }}>• {s}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Copy */}
          {item.copy_json && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#8892b8' }}>Copy</p>
              <CopyPreview copy={item.copy_json} channel={item.channel} />
            </div>
          )}

          {/* Image regen (designer/admin, non-email, image already exists) */}
          {(isAdmin || isDesigner) && !isEmail && !needsSourceSelector && (
            <div>
              <button
                onClick={() => setShowRegen(!showRegen)}
                className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f4f6fb')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                <RefreshCw size={12} /> Refine image
              </button>
              {showRegen && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {['warmer tones', 'wider shot', 'more lifestyle', 'remove background', 'better lighting'].map(s => (
                      <button key={s} onClick={() => setRegenInstruction(prev => prev ? `${prev}, ${s}` : s)}
                        className="text-xs px-2 py-1 rounded-full"
                        style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#f4f6fb' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <textarea rows={2} value={regenInstruction} onChange={e => setRegenInstruction(e.target.value)}
                    placeholder="Add instructions to refine this image…"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                    style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
                  <button onClick={sendRegen} disabled={!regenInstruction.trim() || actionLoading === 'regen'}
                    className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    style={{ background: NAVY, color: '#fff' }}>
                    {actionLoading === 'regen' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Regenerate image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Designer suggestions */}
          {isDesigner && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: '#8892b8' }}>Suggest to admin</p>
              <div className="flex gap-2">
                <button onClick={() => setSuggestionModal('cancel')}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ border: '1px solid #f5c2be', color: '#b91c1c', background: '#fff4f3' }}>
                  Suggest cancellation
                </button>
                <button onClick={() => setSuggestionModal('edit')}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#f4f6fb' }}>
                  Suggest plan edit
                </button>
              </div>
            </div>
          )}

          {/* Thread */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: '#8892b8' }}>
              {isClient ? 'Notes' : 'Thread'}
            </p>
            {comments.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: '#8892b8' }}>No messages yet</p>
            )}
            {comments.map(c => <CommentBubble key={c.id} comment={c} />)}
            <div ref={commentsEndRef} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 space-y-3" style={{ borderTop: '1px solid #dde2f0' }}>
          <div className="flex gap-2">
            <textarea rows={2} value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder={isClient ? 'Leave a note for the team…' : 'Add a comment…'}
              className="flex-1 px-3 py-2 text-sm rounded-lg outline-none resize-none"
              style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendComment() }} />
            <button onClick={sendComment} disabled={!commentText.trim() || sendingComment}
              className="p-2 rounded-lg self-end flex-shrink-0 disabled:opacity-40"
              style={{ background: NAVY, color: '#fff' }}>
              {sendingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isAdmin && item.status === 'ready_for_internal_review' && (
              <button onClick={() => doAction('internal-approve', `/content/${item.id}/internal-approve`)}
                disabled={actionLoading === 'internal-approve'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: NAVY, color: '#fff' }}>
                {actionLoading === 'internal-approve' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Approve internally
              </button>
            )}
            {(isAdmin || isDesigner) && ['internal_approved', 'ready_for_internal_review'].includes(item.status) && (
              <button onClick={() => doAction('send-to-client', `/content/${item.id}/send-to-client`)}
                disabled={actionLoading === 'send-to-client'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#7c3aed', color: '#fff' }}>
                {actionLoading === 'send-to-client' ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                Send to client
              </button>
            )}
            {isClient && item.status === 'ready_for_approval' && (
              <button onClick={() => doAction('approve', `/content/${item.id}/approve`)}
                disabled={actionLoading === 'approve'}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: GOLD, color: '#1a1f3a' }}>
                {actionLoading === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Approve
              </button>
            )}
            {isAdmin && !['cancelled', 'published'].includes(item.status) && (
              <button onClick={() => doAction('cancel', `/content/${item.id}/cancel`)}
                disabled={actionLoading === 'cancel'}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ border: '1px solid #dde2f0', color: '#4a5280', background: '#fff' }}>
                Cancel
              </button>
            )}
          </div>
          {item.status === 'approved' && (
            <p className="text-xs text-center py-1 font-medium" style={{ color: '#15803d' }}>
              Approved — this content is ready to publish.
            </p>
          )}
        </div>
      </div>

      {/* Suggestion modal */}
      {suggestionModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,26,80,0.5)' }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#1a1f3a' }}>
              {suggestionModal === 'cancel' ? 'Suggest cancellation' : 'Suggest plan edit'}
            </h3>
            <textarea rows={4} value={suggestionMsg} onChange={e => setSuggestionMsg(e.target.value)}
              placeholder="Explain your suggestion…"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none mb-3"
              style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setSuggestionModal(null); setSuggestionMsg('') }}
                className="text-sm px-4 py-2 rounded-lg" style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>
                Cancel
              </button>
              <button onClick={sendSuggestion} disabled={!suggestionMsg.trim()}
                className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                style={{ background: NAVY, color: '#fff' }}>
                Submit suggestion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
