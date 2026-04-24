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
  | 'ready_for_approval'
  | 'changes_requested'
  | 'approved'
  | 'published'
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

export interface CampaignPlan {
  id: number
  brand_key: string
  month_label: string
  status: string
  plan_json: unknown[]
  created_at: string
  updated_at: string
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
