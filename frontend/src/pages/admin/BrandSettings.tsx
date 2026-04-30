import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { api } from '../../api/client'
import { Brand, BrandMemoryRule } from '../../types'
import { useToast } from '../../contexts/ToastContext'
import { Check, X, Plus, Loader2, Settings, Brain } from 'lucide-react'

const NAVY = '#1a2d82'

const PROVIDERS = [
  { value: 'fal_flux', label: 'FAL FLUX (default)' },
  { value: 'stability', label: 'Stability AI' },
  { value: 'ideogram', label: 'Ideogram' },
]

const RULE_TYPES = ['copy', 'visual', 'formatting'] as const
const RULE_TYPE_LABELS: Record<string, string> = {
  copy: 'Copy',
  visual: 'Visual',
  formatting: 'Formatting',
}
const RULE_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  copy:       { bg: '#eff6ff', color: '#1d4ed8' },
  visual:     { bg: '#fce7f3', color: '#9d174d' },
  formatting: { bg: '#f0fdf4', color: '#166534' },
}

function RuleBadge({ type }: { type: string }) {
  const s = RULE_TYPE_COLORS[type] ?? { bg: '#f4f6fb', color: '#4a5280' }
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={s}>
      {RULE_TYPE_LABELS[type] ?? type}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'confirmed' ? '#16A34A' : status === 'rejected' ? '#DC2626' : '#D97706'
  const label = status === 'confirmed' ? 'Confirmed' : status === 'rejected' ? 'Rejected' : 'Pending review'
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

export default function BrandSettings() {
  const { toast } = useToast()
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [brand, setBrand] = useState<Brand | null>(null)
  const [rules, setRules] = useState<BrandMemoryRule[]>([])
  const [savingProvider, setSavingProvider] = useState(false)
  const [provider, setProvider] = useState('fal_flux')
  const [loadingRules, setLoadingRules] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)

  // Add rule form
  const [showAddRule, setShowAddRule] = useState(false)
  const [newRuleText, setNewRuleText] = useState('')
  const [newRuleType, setNewRuleType] = useState<'copy' | 'visual' | 'formatting'>('copy')
  const [addingRule, setAddingRule] = useState(false)

  useEffect(() => {
    api.get<Brand[]>('/brands').then(bs => {
      setBrands(bs)
      if (bs.length > 0) setSelectedKey(bs[0].key)
    })
  }, [])

  useEffect(() => {
    if (!selectedKey) return
    const b = brands.find(b => b.key === selectedKey) ?? null
    setBrand(b)
    setProvider(b?.image_provider ?? 'fal_flux')
    setLoadingRules(true)
    api.get<BrandMemoryRule[]>(`/brands/${selectedKey}/memory`)
      .then(setRules)
      .finally(() => setLoadingRules(false))
  }, [selectedKey, brands])

  const saveProvider = async () => {
    if (!brand) return
    setSavingProvider(true)
    try {
      await api.put(`/brands/${brand.key}`, { image_provider: provider })
      setBrands(bs => bs.map(b => b.key === brand.key ? { ...b, image_provider: provider } : b))
      toast('Image provider updated')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save', 'error')
    } finally {
      setSavingProvider(false)
    }
  }

  const addRule = async () => {
    if (!newRuleText.trim() || !selectedKey) return
    setAddingRule(true)
    try {
      const rule = await api.post<BrandMemoryRule>(`/brands/${selectedKey}/memory`, {
        rule_text: newRuleText.trim(),
        rule_type: newRuleType,
        source: 'manual',
      })
      setRules(prev => [rule, ...prev])
      setNewRuleText('')
      setShowAddRule(false)
      toast('Rule added')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to add rule', 'error')
    } finally {
      setAddingRule(false)
    }
  }

  const patchRule = async (ruleId: number, status: 'confirmed' | 'rejected') => {
    setActionId(ruleId)
    try {
      const updated = await api.patch<BrandMemoryRule>(`/brands/${selectedKey}/memory/${ruleId}`, { status })
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update', 'error')
    } finally {
      setActionId(null)
    }
  }

  const deleteRule = async (ruleId: number) => {
    setActionId(ruleId)
    try {
      await api.patch<BrandMemoryRule>(`/brands/${selectedKey}/memory/${ruleId}`, { status: 'rejected' })
      setRules(prev => prev.filter(r => r.id !== ruleId))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete', 'error')
    } finally {
      setActionId(null)
    }
  }

  const confirmed = rules.filter(r => r.status === 'confirmed')
  const pending = rules.filter(r => r.status === 'pending_review')

  return (
    <div className="flex min-h-screen" style={{ background: '#f4f6fb' }}>
      <Sidebar />
      <main className="flex-1 p-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-xl font-semibold" style={{ color: '#1a1f3a' }}>Brand Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: '#4a5280' }}>Image provider and brand memory rules</p>
        </div>

        {/* Brand selector */}
        <div className="mb-6">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1a1f3a' }}>Brand</label>
          <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
            {brands.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
          </select>
        </div>

        {brand && (
          <>
            {/* Image provider card */}
            <div className="rounded-xl p-5 mb-5" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
              <div className="flex items-center gap-2 mb-4">
                <Settings size={15} style={{ color: NAVY }} />
                <p className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>Image provider</p>
              </div>
              <div className="flex items-center gap-3">
                <select value={provider} onChange={e => setProvider(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}>
                  {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <button onClick={saveProvider} disabled={savingProvider || provider === brand.image_provider}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
                  style={{ background: NAVY, color: '#fff' }}>
                  {savingProvider ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Save
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: '#8892b8' }}>
                Sets the AI image generation model for all posts under this brand.
              </p>
            </div>

            {/* Brand memory card */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dde2f0' }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #dde2f0' }}>
                <div className="flex items-center gap-2">
                  <Brain size={15} style={{ color: NAVY }} />
                  <p className="text-sm font-semibold" style={{ color: '#1a1f3a' }}>Brand memory</p>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#e8eeff', color: NAVY }}>
                    {confirmed.length} active
                  </span>
                </div>
                <button onClick={() => setShowAddRule(!showAddRule)}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: NAVY, color: '#fff' }}>
                  <Plus size={12} /> Add rule
                </button>
              </div>

              {/* Add rule form */}
              {showAddRule && (
                <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid #dde2f0', background: '#f8f9ff' }}>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: '#1a1f3a' }}>Rule</label>
                    <textarea rows={2} value={newRuleText} onChange={e => setNewRuleText(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                      style={{ border: '1px solid #dde2f0', color: '#1a1f3a' }}
                      placeholder="e.g. Always use 'sustainable' rather than 'eco-friendly'" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#e8ebf5' }}>
                      {RULE_TYPES.map(t => (
                        <button key={t} onClick={() => setNewRuleType(t)}
                          className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                          style={newRuleType === t
                            ? { background: '#fff', color: NAVY, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                            : { color: '#4a5280', background: 'transparent' }}>
                          {RULE_TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                    <button onClick={addRule} disabled={addingRule || !newRuleText.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
                      style={{ background: NAVY, color: '#fff' }}>
                      {addingRule ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                      Add
                    </button>
                    <button onClick={() => { setShowAddRule(false); setNewRuleText('') }}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ border: '1px solid #dde2f0', color: '#4a5280' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {loadingRules ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={18} className="animate-spin" style={{ color: '#8892b8' }} />
                </div>
              ) : rules.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm" style={{ color: '#8892b8' }}>No memory rules yet.</p>
                  <p className="text-xs mt-1" style={{ color: '#8892b8' }}>
                    Rules are added automatically from client feedback or manually above.
                  </p>
                </div>
              ) : (
                <>
                  {/* Pending review */}
                  {pending.length > 0 && (
                    <div>
                      <div className="px-5 py-2" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                        <p className="text-xs font-semibold" style={{ color: '#92400e' }}>
                          Pending review ({pending.length})
                        </p>
                      </div>
                      {pending.map(rule => (
                        <div key={rule.id} className="px-5 py-3.5" style={{ borderBottom: '1px solid #f4f6fb' }}>
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm" style={{ color: '#1a1f3a' }}>{rule.rule_text}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <RuleBadge type={rule.rule_type} />
                                {rule.source_comment && (
                                  <span className="text-xs truncate max-w-[200px]" style={{ color: '#8892b8' }}>
                                    From: "{rule.source_comment}"
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {actionId === rule.id ? (
                                <Loader2 size={14} className="animate-spin" style={{ color: '#8892b8' }} />
                              ) : (
                                <>
                                  <button onClick={() => patchRule(rule.id, 'confirmed')}
                                    title="Confirm"
                                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                                    style={{ background: '#e8f8ef', color: '#0f7b3f' }}>
                                    <Check size={11} /> Confirm
                                  </button>
                                  <button onClick={() => patchRule(rule.id, 'rejected')}
                                    title="Reject"
                                    className="p-1.5 rounded-lg"
                                    style={{ background: '#fff4f3', color: '#b91c1c' }}>
                                    <X size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Confirmed rules */}
                  {confirmed.length > 0 && (
                    <div>
                      {pending.length > 0 && (
                        <div className="px-5 py-2" style={{ background: '#f8f9ff', borderBottom: '1px solid #dde2f0' }}>
                          <p className="text-xs font-semibold" style={{ color: '#4a5280' }}>
                            Active rules ({confirmed.length})
                          </p>
                        </div>
                      )}
                      {confirmed.map(rule => (
                        <div key={rule.id} className="px-5 py-3.5 flex items-start gap-3"
                          style={{ borderBottom: '1px solid #f4f6fb' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm" style={{ color: '#1a1f3a' }}>{rule.rule_text}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <RuleBadge type={rule.rule_type} />
                              <StatusDot status={rule.status} />
                            </div>
                          </div>
                          <button onClick={() => deleteRule(rule.id)} disabled={actionId === rule.id}
                            title="Remove rule"
                            className="p-1.5 rounded-lg flex-shrink-0 disabled:opacity-40"
                            style={{ background: '#fff4f3', color: '#b91c1c' }}>
                            {actionId === rule.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <X size={12} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
