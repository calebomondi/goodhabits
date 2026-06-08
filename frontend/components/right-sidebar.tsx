"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { PanelRightIcon, PanelRightCloseIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const COOKIE_NAME = "right_sidebar:state"

export function RightSidebar({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [open, setOpen] = React.useState(true)
  const initialized = React.useRef(false)

  React.useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(COOKIE_NAME))
    if (match) {
      setOpen(match.split("=")[1] === "true")
    }
  }, [])

  const toggle = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=${604800}`
      return next
    })
  }, [])

  return (
    <div
      className={cn("group text-sidebar-foreground", className)}
      data-state={open ? "expanded" : "collapsed"}
      data-collapsible={open ? "" : "offcanvas"}
      data-side="right"
    >
      {/* Gap div — controls grid column width */}
      <div className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0" />

      {/* Fixed panel */}
      <div
        data-side="right"
        className="fixed inset-y-0 right-0 z-10 hidden h-svh w-(--sidebar-width) flex-col bg-sidebar border-l border-sidebar-border transition-[right,width] duration-200 ease-linear data-[side=right]:right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] md:flex"
        {...props}
      >
        <div className="flex size-full flex-col bg-sidebar">
          {children || (
            <>
              <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
                <span className="text-sm font-semibold">Widgets</span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <p className="text-sm text-sidebar-foreground/60">
                  Add widgets to the right sidebar.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className="fixed top-1/2 -translate-y-1/2 z-20 size-8 bg-sidebar text-sidebar-foreground rounded-l-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-[right] duration-200 ease-linear hidden md:inline-flex items-center justify-center"
        style={{ right: open ? "var(--sidebar-width)" : "0px" }}
      >
        {open ? (
          <PanelRightCloseIcon className="size-4" />
        ) : (
          <PanelRightIcon className="size-4" />
        )}
      </Button>
    </div>
  )
}
