"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { contentIn, contentOut, labelSwap, spring } from "@/lib/motion-tokens"

export function Disclosure({
  show,
  className,
  children,
}: {
  show: boolean
  className?: string
  children: React.ReactNode
}) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          className={className}
          style={{ overflow: "hidden" }}
          initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={{
            height: "auto",
            opacity: 1,
            transition: reduced ? { duration: 0.15 } : spring.surface,
          }}
          exit={{
            ...(reduced ? {} : { height: 0 }),
            opacity: 0,
            pointerEvents: "none",
            transition: reduced ? { duration: 0.15 } : spring.surfaceClose,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function CascadeItem({
  index,
  className,
  children,
}: {
  index: number
  className?: string
  children: React.ReactNode
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div className={className} {...contentIn(index, reduced)} exit={contentOut}>
      {children}
    </motion.div>
  )
}

export function RollText({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <span className={className} style={{ display: "inline-grid", overflow: "hidden" }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={text}
          style={{ gridArea: "1 / 1" }}
          {...(reduced
            ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
            : labelSwap)}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
