interface LogoProps {
  size?: number
  withWordmark?: boolean
  className?: string
  animated?: boolean
}

/**
 * WorshipFlow — símbolo vetorial que une a cruz (fé) à nota musical e à
 * onda sonora (música). Quadrado arredondado com traço em gradiente neon.
 */
export function Logo({ size = 48, withWordmark = false, className = '', animated = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        aria-label="WorshipFlow"
        role="img"
      >
        {animated && (
          <span className="absolute inset-0 rounded-[30%] bg-neon-cyan/30 blur-lg animate-pulse-ring" />
        )}
        <svg
          viewBox="0 0 48 48"
          width={size}
          height={size}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative block"
        >
          <defs>
            <linearGradient id="wf-frame" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
              <stop stopColor="#22D3EE" />
              <stop offset="0.52" stopColor="#818CF8" />
              <stop offset="1" stopColor="#F0C674" />
            </linearGradient>
            <linearGradient id="wf-core" x1="12" y1="10" x2="30" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#67E8F9" />
              <stop offset="0.6" stopColor="#A78BFA" />
              <stop offset="1" stopColor="#F0C674" />
            </linearGradient>
            <linearGradient id="wf-wave" x1="27" y1="18" x2="40" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#22D3EE" />
              <stop offset="1" stopColor="#A78BFA" />
            </linearGradient>
            <linearGradient id="wf-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#17171C" />
              <stop offset="1" stopColor="#0B0B0E" />
            </linearGradient>
          </defs>

          <rect x="1.6" y="1.6" width="44.8" height="44.8" rx="13.4" fill="url(#wf-bg)" />
          <rect
            x="1.6"
            y="1.6"
            width="44.8"
            height="44.8"
            rx="13.4"
            stroke="url(#wf-frame)"
            strokeWidth="1.6"
            opacity="0.9"
          />

          {/* Cruz estilizada (a haste vertical é a haste da nota) */}
          <path
            d="M20.5 10.5V31.5"
            stroke="url(#wf-core)"
            strokeWidth="3.1"
            strokeLinecap="round"
          />
          <path
            d="M13.5 18.5H25.5"
            stroke="url(#wf-core)"
            strokeWidth="3.1"
            strokeLinecap="round"
          />

          {/* Cabeça da nota */}
          <ellipse
            cx="15.6"
            cy="32.6"
            rx="5.2"
            ry="4"
            transform="rotate(-20 15.6 32.6)"
            fill="url(#wf-core)"
          />

          {/* Onda sonora */}
          <path
            d="M29 21.5C32.6 23.4 32.6 28 29 29.9"
            stroke="url(#wf-wave)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M34 17.8C40.2 21.6 40.2 29.8 34 33.6"
            stroke="url(#wf-wave)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.65"
          />
        </svg>
      </div>

      {withWordmark && (
        <div className="leading-none">
          <div className="font-display text-[1.35rem] font-extrabold tracking-tight text-white">
            Worship<span className="neon-text">Flow</span>
          </div>
          <div className="mt-1 text-[0.6rem] font-medium uppercase tracking-[0.28em] text-zinc-500">
            Ministério de Louvor
          </div>
        </div>
      )}
    </div>
  )
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return <Logo size={size} />
}
