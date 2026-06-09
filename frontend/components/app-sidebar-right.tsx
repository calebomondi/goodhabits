"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { 
  BadgeCheck, LoaderCircle, BadgeAlert, CircleX,
  LayoutDashboardIcon, ListIcon, ChartBarIcon, FolderIcon, UsersIcon, CameraIcon, FileTextIcon, Settings2Icon, CircleHelpIcon, SearchIcon, DatabaseIcon, FileChartColumnIcon, FileIcon, CommandIcon } from "lucide-react"

import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useIdentitySDK, useClaimSDK } from "@goodsdks/react-hooks"
import { chainConfigs, CHAIN_DECIMALS, isSupportedChain, SupportedChains } from "@goodsdks/citizen-sdk"
import { formatUnits, maxUint256 } from "viem"
import { SDK_ENV } from "../app/config"
import { TOKENS, useTokenBalance, useDeposit, useHasUserSetStrategy, useAllowance, useApprove } from "@/lib/hooks"
import { getTreasuryAddress } from "@/lib/contract"
import { Separator } from "./ui/separator";


const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: (
        <LayoutDashboardIcon
        />
      ),
    },
    {
      title: "Lifecycle",
      url: "#",
      icon: (
        <ListIcon
        />
      ),
    },
    {
      title: "Analytics",
      url: "#",
      icon: (
        <ChartBarIcon
        />
      ),
    },
    {
      title: "Projects",
      url: "#",
      icon: (
        <FolderIcon
        />
      ),
    },
    {
      title: "Team",
      url: "#",
      icon: (
        <UsersIcon
        />
      ),
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: (
        <CameraIcon
        />
      ),
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: "Get Help",
      url: "#",
      icon: (
        <CircleHelpIcon
        />
      ),
    },
    {
      title: "Search",
      url: "#",
      icon: (
        <SearchIcon
        />
      ),
    },
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: (
        <DatabaseIcon
        />
      ),
    },
    {
      name: "Reports",
      url: "#",
      icon: (
        <FileChartColumnIcon
        />
      ),
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: (
        <FileIcon
        />
      ),
    },
  ],
}

export function AppSidebarRight({ ...props }: React.ComponentProps<typeof Sidebar>) {
  
  const [isSigningModalOpen, setIsSigningModalOpen] = React.useState(false)
  const checkedRef = React.useRef<string | null>(null)

  const statusIconMap = {
    loading: <LoaderCircle className="animate-spin size-5 text-gray-500" />,
    verified: <BadgeCheck className="size-5 text-green-600" />,
    unverified: <BadgeAlert className="size-5 text-orange-600" />,
    error: <CircleX className="size-5 text-red-600" />,
  }

  type IdentityState =
    | { status: "loading" }
    | { status: "verified"; root: string; expiresAt: Date }
    | { status: "unverified" }
    | { status: "error"; message: string }

  const [identityState, setIdentityState] = React.useState<IdentityState>({
    status: "loading",
  })
  const [expiry, setExpiry] = React.useState<string | undefined>(undefined)
  const [isWhitelisted, setIsWhitelisted] = React.useState<boolean | undefined>(undefined)
  const [rootAddress, setRootAddress] = React.useState<string | undefined>(undefined)

  const { address, isConnected, chainId } = useAccount()
  const { sdk: identitySDK, loading: sdkLoading, error: sdkError } = useIdentitySDK(SDK_ENV)

  const handleVerify = async () => {
    if (!identitySDK || !address || isVerifying) return
    setIsVerifying(true)

    try {
      const fvLink = await identitySDK.generateFVLink(
        false,
        window.location.href,
        42220,
      )

      window.location.href = fvLink
    } catch (error) {
      console.error("Verification failed:", error)
      toast.error("Verification failed — please try again")
      setIsVerifying(false)
    }
  }

  const { sdk: claimSDK, loading: claimSDKLoading, error: claimSDKError } = useClaimSDK(SDK_ENV)
  const [claimAmount, setClaimAmount] = React.useState<number | null>(null)
  const [isClaiming, setIsClaiming] = React.useState(false)
  const [isClaimLoading, setIsClaimLoading] = React.useState(false)
  const [altClaimAvailable, setAltClaimAvailable] = React.useState(false)
  const [altChainId, setAltChainId] = React.useState<SupportedChains | null>(null)

  const [isVerifying, setIsVerifying] = React.useState(false)
  const [depositAmount, setDepositAmount] = React.useState("")
  const { balance: g$Balance, isLoading: g$Loading, refetch: refetchBalance } = useTokenBalance(TOKENS.G$, address)
  const { deposit: writeDeposit, hash: depositHash, isWritePending: depositPending, isConfirming: depositConfirming, isConfirmed: depositConfirmed } = useDeposit(chainId)
  const { hasSetStrategy, isLoading: isCheckingStrategy } = useHasUserSetStrategy(address, chainId)
  const treasuryAddress = getTreasuryAddress(chainId)
  const { allowance, isLoading: allowanceLoading, refetch: refetchAllowance } = useAllowance(TOKENS.G$, address, treasuryAddress)
  const { approve, isWritePending: approvePending, isConfirming: approveConfirming, isConfirmed: isApproved } = useApprove(TOKENS.G$, treasuryAddress)
  const [pendingDeposit, setPendingDeposit] = React.useState(false)

  React.useEffect(() => {
    const initializeClaim = async () => {
      if (!claimSDK || !chainId || !address) return
      setIsClaimLoading(true)
      try {
        if (!isSupportedChain(chainId)) return
        const { amount, altClaimAvailable: altAvail, altChainId: altId } = await claimSDK.checkEntitlement()
        const decimals = CHAIN_DECIMALS[chainId as SupportedChains]
        const formatted = formatUnits(amount, decimals)
        const rounded = Math.round((Number(formatted) + Number.EPSILON) * 100) / 100
        setClaimAmount(rounded)
        setAltClaimAvailable(altAvail)
        setAltChainId(altAvail ? (altId ?? null) : null)
      } catch (e) {
        console.error("initializeClaim error:", e)
        setClaimAmount(null)
        toast.error("Failed to check UBI entitlement")
      } finally {
        setIsClaimLoading(false)
      }
    }
    if (!claimSDKLoading && claimSDK) initializeClaim()
  }, [address, chainId, claimSDK, claimSDKLoading])

  const handleClaim = async () => {
    if (!claimSDK) return
    setIsClaiming(true)
    try {
      const tx = await claimSDK.claim()
      if (tx) {
        setClaimAmount(null)
        refetchBalance()
        toast.success("UBI claim successful!")
      }
    } catch (err) {
      console.error("Claim failed:", err)
      toast.error(`${err instanceof Error ? err.message : "Claim failed"}`)
    } finally {
      setIsClaiming(false)
    }
  }

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get("verified") === "true") {
      window.history.replaceState({}, document.title, window.location.pathname)
      checkedRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!address || !identitySDK || sdkLoading) {
      setIdentityState({ status: "loading" })
      return
    }

    if (checkedRef.current === address) return
    checkedRef.current = address

    setIdentityState({ status: "loading" })

    const check = async () => {
      try {
        const { isWhitelisted, root } = await identitySDK.getWhitelistedRoot(
          address,
        )

        setIsWhitelisted(isWhitelisted)
        setRootAddress(root)

        if (!isWhitelisted) {
          setIdentityState({ status: "unverified" })
          setExpiry(undefined)
          return
        }

        const expiryData = await identitySDK.getIdentityExpiryData(
          root as `0x${string}`,
        )
        const { expiryTimestamp } = identitySDK.calculateIdentityExpiry(
          expiryData?.lastAuthenticated ?? BigInt(0),
          expiryData?.authPeriod ?? BigInt(0),
        )

        const date = new Date(Number(expiryTimestamp))
        const formattedExpiryTimestamp = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "2-digit",
        })
        setExpiry(formattedExpiryTimestamp)

        setIdentityState({
          status: "verified",
          root,
          expiresAt: new Date(Number(expiryTimestamp)),
        })
      } catch (e) {
        console.error("identity check error:", e)
        checkedRef.current = null
        setIdentityState({ status: "error", message: String(e) })
        toast.error("Failed to load identity data")
      }
    }

    check()
  }, [address, identitySDK, sdkLoading])

  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (depositConfirmed) toast.success("Deposit confirmed on-chain!")
  }, [depositConfirmed])

  React.useEffect(() => {
    if (depositConfirmed) {
      setDepositAmount("")

      fetch(`/api/analytics/refresh?user=${address}${depositHash ? `&txHash=${depositHash}` : ''}`, { method: "POST" })
        .finally(() => {
          refetchBalance()
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey[0] as Record<string, unknown>
              return k?.entity === 'readContract' && k?.functionName === 'balanceOf' && k?.address === TOKENS.G$
            },
          })
          queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey[0] as Record<string, unknown>
              return k?.entity === 'readContract' && k?.functionName === 'getUserAllocation'
            },
          })
          queryClient.invalidateQueries({ queryKey: ["treasury", "users", address] })
          queryClient.invalidateQueries({ queryKey: ["analytics", "summary"] })
          queryClient.refetchQueries({ queryKey: ["user-txns", address] })
          queryClient.refetchQueries({ queryKey: ["analytics", "volume"] })
          queryClient.invalidateQueries({ queryKey: ["analytics", "leaderboard"] })
          queryClient.invalidateQueries({ queryKey: ["leaderboard", "status", address] })
        })
    }
  }, [depositConfirmed, address, depositHash, queryClient, refetchBalance])

  React.useEffect(() => {
    if (pendingDeposit && isApproved) {
      setPendingDeposit(false)
      const amountInWei = BigInt(Math.round(Number.parseFloat(depositAmount) * 1e18))
      writeDeposit(amountInWei)
      refetchAllowance()
    }
  }, [pendingDeposit, isApproved])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/" className="flex items-center">
                <img src="/gooddollar.webp" alt="GoodDollar" className="size-8" />
                <span className="text-lg font-semibold">GoodDollar</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

       <Separator className="my-1 group-data-[collapsible=icon]:hidden" />

      <SidebarContent>
        <div className={!isConnected ? "opacity-50 pointer-events-none" : ""}>
          <NavMain 
            items={data.navMain} 
            status={{
              title: identityState.status,
              icon: statusIconMap[identityState.status],
              isConnected,
              color: identityState.status === "verified" ? "bg-green-200" : identityState.status === "unverified" ? "bg-orange-200" : "bg-red-200",
              function: handleVerify,
            }}
            claim={{
              amount: claimAmount,
              isClaiming,
              isLoading: isClaimLoading,
              onClaim: handleClaim,
              altClaimAvailable,
              altChainLabel: altChainId ? chainConfigs[altChainId]?.label : undefined,
            }}
            deposit={{
              amount: depositAmount,
              onAmountChange: setDepositAmount,
              onMax: () => setDepositAmount(g$Balance?.toString() ?? "0"),
              onSubmit: () => {
                const amountInWei = BigInt(Math.round(Number.parseFloat(depositAmount) * 1e18))
                if (allowance !== null && amountInWei > allowance) {
                  approve(maxUint256)
                  setPendingDeposit(true)
                } else {
                  writeDeposit(amountInWei)
                }
              },
              isSubmitting: depositPending || depositConfirming || approvePending || approveConfirming,
              loading: g$Loading || allowanceLoading,
              balance: g$Balance,
              strategySet: hasSetStrategy ?? false,
              strategyLoading: isCheckingStrategy,
              needsApproval: allowance !== null && BigInt(Math.round(Number.parseFloat(depositAmount || "0") * 1e18)) > allowance,
              isApproving: approvePending || approveConfirming,
            }}
          />
          {/* <NavDocuments items={data.documents} /> */}
        </div>
        <NavSecondary 
          items={[
            { title: "Status", value: `${isWhitelisted ? "Whitelisted" : "Not Whitelisted"}`},
            { title: "Root Identity", value: rootAddress ? `${rootAddress.slice(0, 6)}...${rootAddress.slice(-4)}` : "N/A" },
          ]} 
          expiry={expiry ? { isExpired: new Date(expiry as string) < new Date(), date: expiry } : undefined}
          className="mt-auto" 
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={
          {
            name: address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : "Not Connected",
            email: address as string,
            avatar: "/avatars/shadcn.jpg"
          }
        } />
      </SidebarFooter>
    </Sidebar>
  )
}
