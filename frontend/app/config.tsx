"use client"

import { createAppKit } from "@reown/appkit/react"
import { http, WagmiProvider } from "wagmi"
import { celo, fuse, xdc, type AppKitNetwork } from "@reown/appkit/networks"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import React, { ReactNode } from "react"

export const SDK_ENV = "production" as const

const queryClient = new QueryClient()

const projectId = "81695f4d3284877ad0414039a2f85247"

const metadata = {
  name: "GoodHabit",
  description: "GoodHabit",
  url: "https://example.com", // origin must match your domain & subdomain
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
}

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [celo, fuse, xdc]

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  transports: {
    [xdc.id]: http("https://rpc.ankr.com/xdc"),
    [fuse.id]: http("https://rpc.fuse.io"),
    [celo.id]: http(`${process.env.NEXT_PUBLIC_CELO_MAINNET_RPC_URL || "https://forno.celo.org"}`),
  },
})

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true,
    socials: ["google", "apple", "x"],
    email: true,
    emailShowWallets: true,
  },
  themeMode: "light",
  themeVariables: {
    "--w3m-color-mix-strength": 0,
    "--w3m-accent": "#000000",
  },
})

appKit.setConnectMethodsOrder(["social", "email", "wallet"])

type ComponentProps = {
  children: ReactNode
}
export const AppKitProvider: React.FC<ComponentProps> = ({ children }) => {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}