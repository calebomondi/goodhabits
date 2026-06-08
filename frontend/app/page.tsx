"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

type Dot = { top: number; left: number; size: number; color: string; delay: number }

const INITIAL_DOTS: Dot[] = [
  { top: 25, left: 10, size: 16, color: 'bg-amber-400/40 dark:bg-amber-500/30', delay: 0 },
  { top: 33, left: 85, size: 24, color: 'bg-violet-400/30 dark:bg-violet-500/20', delay: 0.5 },
  { top: 66, left: 20, size: 12, color: 'bg-orange-400/40 dark:bg-orange-500/30', delay: 1 },
  { top: 75, left: 75, size: 20, color: 'bg-rose-300/30 dark:bg-rose-500/20', delay: 1.5 },
]

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [dots, setDots] = useState<Dot[]>(INITIAL_DOTS)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      setDots(prev => prev.map(d => ({
        ...d,
        top: 8 + Math.random() * 78,
        left: 4 + Math.random() * 92,
      })))
    }, 4000)
    return () => clearInterval(interval)
  }, [mounted])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-violet-100 dark:from-gray-950 dark:via-gray-900 dark:to-violet-950">
      {/* Decorative background blobs */}
      <div
        className="absolute -top-48 -right-48 h-[600px] w-[600px] animate-pulse rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-500/5"
        style={mounted ? { animationDuration: '6s' } : undefined}
      />
      <div
        className="absolute -bottom-48 -left-48 h-[500px] w-[500px] animate-pulse rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-500/5"
        style={mounted ? { animationDuration: '8s', animationDelay: '2s' } : undefined}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] animate-pulse rounded-full bg-orange-200/10 blur-3xl dark:bg-orange-500/5"
        style={mounted ? { animationDuration: '7s', animationDelay: '4s' } : undefined}
      />

      {/* Floating decorative dots — drift randomly */}
      {dots.map((dot, i) => (
        <div
          key={i}
          className={`absolute rounded-full transition-all duration-[4000ms] ease-in-out ${dot.color}`}
          style={{
            top: `${dot.top}%`,
            left: `${dot.left}%`,
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            transitionDelay: `${dot.delay}s`,
          }}
        />
      ))}

      {/* Hero content */}
      <main className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
        <div
          className="transition-all duration-1000"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          {/* Logo */}
          <img
            src="/goodhabit.png"
            alt="GoodHabit"
            className="mx-auto mb-8 h-16 w-16 md:h-20 md:w-20"
          />

          {/* Headline */}
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Turn daily{" "}
            <span className="bg-gradient-to-r from-amber-500 to-violet-600 bg-clip-text text-transparent">
              UBI
            </span>{" "}
            into lasting{" "}
            <span className="bg-gradient-to-r from-violet-600 to-amber-500 bg-clip-text text-transparent">
              wealth
            </span>
          </h1>

          {/* Sub-text */}
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">
            GoodHabit helps you save, invest, and grow your GoodDollar UBI
            effortlessly. Set your strategy, build streaks, and let your money
            work for you.
          </p>

          {/* CTA */}
          <div className="mt-10">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3.5 font-heading text-base font-semibold text-background shadow-lg transition-all hover:opacity-90 hover:shadow-xl active:scale-95"
            >
              Start your journey
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
