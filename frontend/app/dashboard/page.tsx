"use client"

import { SignInButton } from "@/components/sign-in-button"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { AppSidebarLeft } from "@/components/app-sidebar-left"
import { AppSidebarRight } from "@/components/app-sidebar-right"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { Leaderboard } from "@/components/leaderboard"
import { SiteHeader } from "@/components/site-header"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { PanelLeftIcon } from "lucide-react"
import { AgentChat } from "@/components/agent-chat"
import { useIsMobile } from "@/hooks/use-mobile"

export default function Page() {
  const isMobile = useIsMobile()
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const { address } = useAccount()
  const [tab, setTab] = useState<"trend" | "leaderboard">("trend")

  const { data: txns, isPending: txnsLoading, isError: txnsError } = useQuery({
    queryKey: ["user-txns", address],
    queryFn: () => fetch(`/api/analytics/user-txns?user=${address}`).then((r) => r.json()),
    enabled: !!address,
    staleTime: 0,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (txnsError) toast.error("Failed to load transaction data")
  }, [txnsError])

  useEffect(() => {
    if (isMobile) {
      setLeftOpen(false)
      setRightOpen(false)
    }
  }, [isMobile])

  const sidebarStyle = {
    "--sidebar-width": "calc(var(--spacing) * 72)",
    "--header-height": "calc(var(--spacing) * 12)",
  } as React.CSSProperties

  const leftSidebarStyle = {
    "--sidebar-width": "min(40vw, 30rem)",
    "--header-height": "calc(var(--spacing) * 12)",
  } as React.CSSProperties

  return (
    <div
      className="grid min-h-svh w-full grid-cols-[auto_1fr_auto] has-data-[variant=inset]:bg-sidebar"
    >
      <SidebarProvider open={leftOpen} onOpenChange={setLeftOpen} style={leftSidebarStyle}>
        <AppSidebarLeft variant="inset" side="left" />
      </SidebarProvider>

      <div className="relative flex w-full flex-1 flex-col bg-background lg:m-2 lg:rounded-xl lg:shadow-sm">
        <SiteHeader
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const next = !leftOpen
                setLeftOpen(next)
                if (next) setRightOpen(false)
              }}
              className="-ml-1"
            >
              <PanelLeftIcon className="size-4" />
            </Button>
          }
          rightTrigger={
            <div className="flex items-center gap-2">
              <SignInButton />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const next = !rightOpen
                  setRightOpen(next)
                  if (next) setLeftOpen(false)
                }}
              >
                <img src="/gooddollar.webp" alt="GoodDollar" className="size-6" />
              </Button>
            </div>
          }
        />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="flex items-center gap-4 px-4 lg:px-6 border-b">
                <button
                  onClick={() => setTab("trend")}
                  className={`pb-2 text-sm font-medium transition-colors ${
                    tab === "trend"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  } cursor-pointer`}
                >
                  My Trend
                </button>
                <button
                  onClick={() => setTab("leaderboard")}
                  className={`pb-2 text-sm font-medium transition-colors ${
                    tab === "leaderboard"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  } cursor-pointer`}
                >
                  Leaderboard
                </button>
              </div>
              {tab === "trend" ? (
                <>
                  <div className="px-4 lg:px-6">
                    <ChartAreaInteractive address={address} />
                  </div>
                    <DataTable data={txns ?? []} loading={txnsLoading} />
                </>
              ) : (
                <Leaderboard />
              )}
            </div>
          </div>
        </div>
      </div>

      <SidebarProvider open={rightOpen} onOpenChange={setRightOpen} style={leftSidebarStyle}>
        <AppSidebarRight variant="inset" side="right" />
      </SidebarProvider>

      <AgentChat address={address} />
    </div>
  )
}
