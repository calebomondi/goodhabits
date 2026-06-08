"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LoaderCircle } from "lucide-react"

export function NavMain({
  items, status, claim, deposit
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
  }[],
  status?: {
    title: "loading" | "verified" | "unverified" | "error"
    icon?: React.ReactNode
    isConnected?: boolean
    color?: string
    function?: () => void
  },
  claim?: {
    amount: number | null
    isClaiming: boolean
    isLoading: boolean
    onClaim: () => void
    altClaimAvailable: boolean
    altChainLabel?: string
    error?: string | null
  },
  deposit?: {
    amount: string
    onAmountChange: (value: string) => void
    onMax: () => void
    onSubmit: () => void
    isSubmitting: boolean
    loading?: boolean
    balance: number | null
    strategySet?: boolean
    strategyLoading?: boolean
    needsApproval?: boolean
    isApproving?: boolean
  }
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {status?.title !== "verified" && status?.title !== "loading" && <p className="p-2 text-orange-500 text-base">Get Verified To Proceed</p>}
          <SidebarMenuItem className="flex items-center gap-2">
            <Button
              size="icon"
              className={`size-8 group-data-[collapsible=icon]:opacity-0 ${status?.color || "bg-gray-500"} ${status?.isConnected ? "" : "bg-gray-300"}`}
              variant="outline"
              disabled={true}
            >
              {status?.title === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : status?.icon}
            </Button>
            <SidebarMenuButton
              tooltip="Quick Create"
              className={`min-w-8 justify-center rounded-full duration-200 ease-linear ${
                status?.title === "verified"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : status?.title === "error"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-orange-500 text-white hover:scale-90 hover:bg-orange-500 hover:text-white hover:cursor-pointer"
              }`}
              onClick={status?.function}
              disabled={status?.title === "verified" || status?.title === "loading"}
            >
              <span className="flex items-center gap-2">
                {status?.title === "loading" && <LoaderCircle className="size-3.5 animate-spin" />}
                {status?.title === "verified"
                  ? "YOU ARE VERIFIED"
                  : status?.title === "loading"
                    ? "Checking..."
                    : status?.title === "error"
                      ? "Retry Verification"
                      : "VERIFY ME"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <Separator className="my-2 group-data-[collapsible=icon]:hidden" />

        <div className="group-data-[collapsible=icon]:hidden flex flex-col gap-2 rounded-lg bg-muted/30 p-3">
          <span className="text-md font-medium text-foreground">Claim Your Daily UBI</span>
          <SidebarMenuButton
              tooltip="Claim UBI"
              className={`min-w-8 justify-center rounded-full duration-200 ease-linear scale-95 hover:scale-100 hover:cursor-pointer h-9 px-4 bg-blue-600 text-white hover:bg-blue-600 hover:text-white active:opacity-90`}
              onClick={claim?.onClaim}
              disabled={status?.title !== "verified" || claim?.isClaiming || claim?.isLoading || claim?.amount === 0 || (!claim?.altClaimAvailable && claim?.amount === null)}
            >
              <span className="flex items-center gap-2">
                {(claim?.isLoading || claim?.isClaiming) && <LoaderCircle className="size-4 animate-spin" />}
                {claim?.isLoading
                  ? "Loading..."
                  : claim?.isClaiming
                    ? "Claiming..."
                    : claim?.amount !== null && claim?.amount !== 0
                      ? `Claim UBI ${claim?.amount}`
                      : claim?.altClaimAvailable && claim?.altChainLabel
                        ? `Claim on ${claim?.altChainLabel}`
                        : "Come back tomorrow"}
              </span>
            </SidebarMenuButton>
        </div>

        <Separator className="my-2 group-data-[collapsible=icon]:hidden" />

        <div className="group-data-[collapsible=icon]:hidden flex flex-col gap-2 rounded-lg bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-md font-medium text-foreground">Deposit G$</span>
            <span className="text-md text-muted-foreground">
              Available: {deposit?.balance?.toLocaleString() ?? "—"} G$
            </span>
          </div>
          <div className="relative">
            <Input
              value={deposit?.amount ?? ""}
              onChange={(e) => deposit?.onAmountChange(e.target.value)}
              placeholder="0.00"
              className="pr-12 h-12 text-sm"
              disabled={deposit?.isSubmitting}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 px-1.5 text-xs font-bold cursor-pointer text-blue-500 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={deposit?.onMax}
              disabled={deposit?.isSubmitting}
            >
              MAX
            </Button>
          </div>
          {deposit?.strategySet === false && !deposit?.strategyLoading && (
            <p className="text-xs text-amber-600 text-center -mb-1">
              Set a habit strategy first before depositing
            </p>
          )}
          {deposit?.needsApproval && !deposit?.isApproving && (
            <p className="text-xs text-amber-600 text-center -mb-1">
              One-time approval — you won't need to approve again
            </p>
          )}
          <Button
            className="w-full bg-blue-600 cursor-pointer hover:bg-blue-700 text-white"
            size="lg"
            onClick={deposit?.onSubmit}
            disabled={deposit?.loading || deposit?.strategyLoading || deposit?.isSubmitting || deposit?.isApproving || !deposit?.amount || Number.parseFloat(deposit?.amount || "0") <= 0 || deposit?.balance === null || deposit?.balance === 0 || !deposit?.strategySet}
          >
            {deposit?.loading
              ? "Loading..."
              : deposit?.needsApproval && !deposit?.isApproving
                ? "Approve G$"
                : deposit?.isApproving
                  ? "Approving..."
                  : deposit?.isSubmitting
                    ? "Depositing..."
                    : "Deposit"}
          </Button>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
