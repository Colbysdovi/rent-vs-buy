"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calculator, Home, TrendingUp, type LucideIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { press, spring } from "@/lib/motion-tokens"

const MotionLink = motion.create(Link)

const items: { label: string; short: string; href: string; icon: LucideIcon }[] = [
  { label: "Résidence Principale", short: "Résidence", href: "/residence-principale", icon: Home },
  { label: "Rendement Locatif", short: "Locatif", href: "/rendement-locatif", icon: TrendingUp },
]

export function TopNav() {
  const pathname = usePathname()
  const reduced = useReducedMotion()

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -bottom-6 -z-10 bg-gradient-to-b from-background from-60% to-transparent"
      />
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 rounded-2xl border border-border bg-background/80 px-3 shadow-lg shadow-foreground/5 backdrop-blur-xl">
        <Link href="/residence-principale" className="mr-2 flex shrink-0 items-center gap-2.5 sm:mr-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Calculator className="size-[18px]" />
          </span>
          <span className="hidden text-lg font-semibold tracking-tight sm:inline">
            Calculateur Immo
          </span>
        </Link>
        <span aria-hidden className="h-6 w-px bg-border" />
        <nav className="flex items-center gap-1">
          {items.map((item) => {
            const active = pathname === item.href
            return (
              <MotionLink
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                whileTap={press}
                transition={spring.small}
                className={cn(
                  "relative flex h-11 items-center rounded-xl px-4 text-sm font-medium transition-colors duration-150",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId={reduced ? undefined : "nav-active"}
                    transition={spring.small}
                    className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-primary/15"
                  />
                )}
                <span className="relative flex items-center gap-2">
                  <item.icon className="size-4" />
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </span>
              </MotionLink>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
