import { PLACEHOLDER_IMAGE } from '../../lib/playerImages'

// Use Sleeper CDN directly for player headshots
const SLEEPER_CDN = 'https://sleepercdn.com/content/nfl/players'

interface PlayerAvatarProps {
  sleeperId: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
}

export default function PlayerAvatar({ sleeperId, name, size = 'sm' }: PlayerAvatarProps) {
  const sizeClass = size === 'sm' ? 'w-7 h-7' : size === 'md' ? 'w-10 h-10' : 'w-16 h-16'

  if (!sleeperId) {
    return (
      <div className={`${sizeClass} rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0`}>
        <span className="text-slate-500 text-xs">?</span>
      </div>
    )
  }

  return (
    <img
      src={`${SLEEPER_CDN}/${sleeperId}.jpg`}
      alt={name}
      className={`${sizeClass} rounded-full object-cover bg-slate-700 flex-shrink-0`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
      }}
    />
  )
}
