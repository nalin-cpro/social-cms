import { CopyJson } from '../types'

export default function CopyPreview({ copy, channel }: { copy: CopyJson; channel: string }) {
  if (channel === 'instagram_post' || channel === 'tiktok') {
    return (
      <div className="space-y-4">
        {copy.hook && (
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Hook</p>
            <p className="text-sm text-primary italic">"{copy.hook}"</p>
          </div>
        )}
        {copy.caption && (
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Caption</p>
            <p className="text-sm text-primary whitespace-pre-line leading-relaxed">{copy.caption}</p>
          </div>
        )}
        {copy.hashtags && (
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Hashtags</p>
            <p className="text-xs text-muted">{copy.hashtags}</p>
          </div>
        )}
      </div>
    )
  }

  if (channel === 'instagram_stories') {
    return (
      <div className="space-y-4">
        {([copy.frame_1, copy.frame_2] as Array<{ label: string; headline: string; body: string } | undefined>).map((frame, i) => frame && (
          <div key={i} className="border border-border rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Frame {i + 1} · {frame.label}</p>
            <p className="text-sm font-medium text-primary">{frame.headline}</p>
            <p className="text-sm text-muted">{frame.body}</p>
          </div>
        ))}
      </div>
    )
  }

  if (channel === 'email') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Subject lines</p>
          <ul className="space-y-1">
            {copy.subject_lines?.map((s, i) => (
              <li key={i} className="text-sm text-primary">"{s}"</li>
            ))}
          </ul>
        </div>
        {copy.preview_text && (
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Preview text</p>
            <p className="text-sm text-muted">{copy.preview_text}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Body</p>
          <ul className="space-y-2">
            {copy.body_points?.map((b, i) => (
              <li key={i} className="text-sm text-primary leading-relaxed pl-3 border-l-2 border-border">{b}</li>
            ))}
          </ul>
        </div>
        {copy.cta && (
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">CTA</p>
            <p className="text-sm font-medium text-primary">{copy.cta}</p>
          </div>
        )}
      </div>
    )
  }

  if (channel === 'sms') {
    return (
      <div>
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Message</p>
        <p className="text-sm text-primary">{copy.message}</p>
        <p className="text-xs text-muted mt-1">{(copy.message ?? '').length} / 160 chars</p>
      </div>
    )
  }

  return <pre className="text-xs text-muted overflow-auto">{JSON.stringify(copy, null, 2)}</pre>
}
