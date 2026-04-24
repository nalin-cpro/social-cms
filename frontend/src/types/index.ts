export type Role = 'admin' | 'designer' | 'client'

export interface User {
  id: number
  email: string
  role: Role
  brand_key: string | null
  created_at: string
}

export interface Brand {
  key: string
  name: string
  config_json: Record<string, unknown>
  analysis_json: Record<string, unknown> | null
  active: boolean
  created_at: string
}

export type ContentStatus =
  | 'pending'
  | 'generating'
  | 'ready_for_internal_review'
  | 'internal_approved'
  | 'ready_for_approval'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'cancelled'
  | 'error'

export interface CopyJson {
  caption?: string
  hashtags?: string
  hook?: string
  frame_1?: { label: string; headline: string; body: string }
  frame_2?: { label: string; headline: string; body: string }
  subject_lines?: string[]
  preview_text?: string
  body_points?: string[]
  cta?: string
  message?: string
  copy_valid?: boolean
  violations?: string[]
}

export interface ContentItem {
  id: number
  plan_id: number | null
  campaign_id: number | null
  brand_key: string
  product_name: string
  campaign: string
  channel: string
  content_type: string
  post_type: string
  scheduled_date: string | null
  status: ContentStatus
  feed_post_url: string | null
  story_1_url: string | null
  story_2_url: string | null
  lifestyle_url: string | null
  copy_json: CopyJson | null
  original_copy_json: CopyJson | null
  visual_direction: string | null
  scene: string | null
  qc_score: number | null
  client_comment: string | null
  revision_count: number
  processed_at: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: number
  brand_key: string
  name: string
  theme: string | null
  visual_direction: string | null
  month_label: string | null
  year: number | null
  start_date: string | null
  end_date: string | null
  created_by: number | null
  status: 'active' | 'draft' | 'complete'
  notes: string | null
  created_at: string
  updated_at: string
  posts?: ContentItem[]
}

export interface CampaignPlan {
  id: number
  brand_key: string
  month_label: string
  status: string
  plan_json: unknown[]
  created_at: string
  updated_at: string
}

export interface ContentComment {
  id: number
  content_item_id: number
  sender_role: 'admin' | 'designer' | 'client' | 'system'
  sender_name: string
  message: string
  is_ai_revision: boolean
  is_internal: boolean
  created_at: string
}

export interface DesignerSuggestion {
  id: number
  content_item_id: number
  designer_id: number
  suggestion_type: 'cancel' | 'edit' | 'regenerate_image'
  message: string
  status: 'pending' | 'accepted' | 'rejected'
  admin_response: string | null
  created_at: string
  resolved_at: string | null
}

export interface HolidayEvent {
  id: number
  brand_key: string | null
  name: string
  date: string
  type: 'holiday' | 'promo' | 'brand_event' | 'client_event'
  notes: string | null
  created_at: string
}

export interface Notification {
  id: number
  recipient_role: Role
  brand_key: string | null
  content_item_id: number | null
  type: string
  message: string
  read: boolean
  created_at: string
}
