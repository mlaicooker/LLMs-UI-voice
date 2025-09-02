import { useEffect, useState } from "react"

export function ParticleBackground() {
  const [particles, setParticles] = useState<{ left: string; top: string }[]>([])

  useEffect(() => {
    // Only run on client
    const generated = Array.from({ length: 20 }).map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
    }))
    setParticles(generated)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full animate-float"
          style={{ left: p.left, top: p.top }}
        />
      ))}
    </div>
  )
}