'use client'

import { useEffect, useRef, useState } from 'react'
import { PARAM_LABELS } from '@/lib/agent'

interface Props {
  params: Record<string, number>
  prevParams?: Record<string, number>
  accentColor?: string
}

export default function ParameterBar({ params, prevParams, accentColor = '#FFC300' }: Props) {
  const [displayed, setDisplayed] = useState<Record<string, number>>(
    prevParams ?? params
  )
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (prevParams) {
      timerRef.current = setTimeout(() => {
        setAnimating(true)
        setDisplayed(params)
      }, 300)
    } else {
      setDisplayed(params)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [params, prevParams])

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(PARAM_LABELS).map(([key, label]) => {
        const val = displayed[key] ?? 0
        const prev = prevParams?.[key] ?? val
        const diff = params[key] - prev
        return (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1" style={{ color: '#94A3B8' }}>
              <span>{label}</span>
              <span style={{ color: accentColor }}>
                {val}
                {animating && diff > 0 && (
                  <span className="ml-1 text-green-400 text-xs fade-in-up">+{diff}</span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${val}%`,
                  background: `linear-gradient(90deg, ${accentColor}88, ${accentColor})`,
                  boxShadow: animating && diff > 0 ? `0 0 8px ${accentColor}` : 'none',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
