"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { press, spring } from "@/lib/motion-tokens"

const TabsValueContext = React.createContext<{ value?: string; id: string }>({ id: "" })

function Tabs({
  className,
  orientation = "horizontal",
  value: valueProp,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const id = React.useId()
  const [inner, setInner] = React.useState(defaultValue)
  const value = valueProp ?? inner
  return (
    <TabsValueContext.Provider value={{ value, id }}>
    <TabsPrimitive.Root
      value={value}
      onValueChange={(v) => {
        setInner(v)
        onValueChange?.(v)
      }}
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
    </TabsValueContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit max-w-full items-center justify-start overflow-x-auto [scrollbar-width:none] sm:justify-center rounded-2xl p-1 text-muted-foreground group-data-horizontal/tabs:h-12 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:p-1 data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const ctx = React.useContext(TabsValueContext)
  const reduced = useReducedMotion()
  const active = ctx.value === props.value
  return (
    <TabsPrimitive.Trigger asChild {...props}>
      <motion.button
        whileTap={press}
        transition={spring.small}
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-transparent! px-3 py-1 text-sm sm:px-4 font-medium whitespace-nowrap text-foreground/60 transition-colors duration-150 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:px-3 group-data-vertical/tabs:py-0.5 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-[state=active]:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      >
        {active && (
          <motion.span
            layoutId={reduced ? undefined : `tab-pill-${ctx.id}`}
            transition={spring.small}
            className="absolute inset-0 rounded-2xl bg-background shadow-sm dark:bg-input/30"
          />
        )}
        <span className="relative flex items-center gap-1.5">{children}</span>
      </motion.button>
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const reduced = useReducedMotion()
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={reduced ? { duration: 0.15 } : spring.content}
      >
        {children}
      </motion.div>
    </TabsPrimitive.Content>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
