import type { Transition } from "motion/react"

// Soft register (forge-ui-motion). Springs use visualDuration/bounce only.
export const spring = {
  surface: { type: "spring", visualDuration: 0.42, bounce: 0.18 },
  surfaceClose: { type: "spring", visualDuration: 0.32, bounce: 0 },
  content: { type: "spring", visualDuration: 0.36, bounce: 0 },
  small: { type: "spring", visualDuration: 0.25, bounce: 0 },
} satisfies Record<string, Transition>

export const stagger = { start: 0.08, step: 0.045, max: 6 }

export function contentIn(i: number, reduced: boolean | null) {
  return {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: reduced
      ? { duration: 0.15 }
      : { ...spring.content, delay: stagger.start + Math.min(i, stagger.max) * stagger.step },
  }
}

export const contentOut = { opacity: 0, filter: "blur(2px)", transition: { duration: 0.1 } }

export const labelSwap = {
  initial: { opacity: 0, y: 12, filter: "blur(3px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(3px)" },
  transition: spring.small,
}

export const press = { scale: 0.96 }

// Chart redraw: short and settled, never a full replay on each keystroke.
export const chartAnimation = { animationDuration: 450, animationEasing: "ease-out" as const }
