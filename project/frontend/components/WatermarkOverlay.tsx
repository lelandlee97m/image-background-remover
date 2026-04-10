'use client'

interface WatermarkOverlayProps {
  show: boolean
}

export default function WatermarkOverlay({ show }: WatermarkOverlayProps) {
  if (!show) return null

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      <svg
        className="w-full h-full"
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.15 }}
      >
        <defs>
          <pattern id="wm-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
            <text
              x="20"
              y="100"
              fontSize="24"
              fontWeight="bold"
              fill="currentColor"
              fontFamily="system-ui, sans-serif"
            >
              BG REMOVER — FREE
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wm-pattern)" color="#000" />
      </svg>
    </div>
  )
}
