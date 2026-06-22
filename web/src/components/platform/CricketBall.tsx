// A real cricket ball: red leather hemisphere highlight + cream seam stitching.
export function CricketBall({ size = 28, className = '' }: { size?: number; className?: string }) {
  const id = 'cyball'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-g`} cx="36%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ff6b6f" />
          <stop offset="42%" stopColor="#d11a26" />
          <stop offset="100%" stopColor="#6b0a11" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={`url(#${id}-g)`} />
      <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      {/* twin seams hugging the right face */}
      <g className="cy-spin" style={{ transformOrigin: '20px 20px' }}>
        <path d="M27 3.5 C 20 12, 20 28, 27 36.5" fill="none" stroke="#f3e9d2" strokeWidth="1.6"
              strokeLinecap="round" strokeDasharray="0.2 3.1" opacity="0.95" />
        <path d="M31 5.5 C 25 12, 25 28, 31 34.5" fill="none" stroke="#f3e9d2" strokeWidth="1.4"
              strokeLinecap="round" strokeDasharray="0.2 3" opacity="0.8" />
        <ellipse cx="14" cy="13" rx="6" ry="4" fill="rgba(255,255,255,0.18)" transform="rotate(-25 14 13)" />
      </g>
    </svg>
  )
}
