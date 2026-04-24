import { ExternalLink, Image } from 'lucide-react'

interface Props {
  url: string | null
  label: string
  aspect?: 'square' | 'story'
}

export default function ImagePreview({ url, label, aspect = 'square' }: Props) {
  const aspectClass = aspect === 'story' ? 'aspect-[9/16]' : 'aspect-square'

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
      <div className={`${aspectClass} w-full bg-surface border border-border rounded-lg overflow-hidden flex items-center justify-center`}>
        {url
          ? <img src={url} alt={label} className="w-full h-full object-cover" />
          : (
            <div className="flex flex-col items-center gap-2 text-muted/40">
              <Image size={32} />
              <span className="text-xs">No image</span>
            </div>
          )
        }
      </div>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-accent hover:underline">
          <ExternalLink size={11} />
          View full size
        </a>
      )}
    </div>
  )
}
