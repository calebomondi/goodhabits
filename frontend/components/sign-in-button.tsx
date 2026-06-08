"use client"

import { useAccount } from "wagmi"
import { appKit } from "@/app/config"

export function SignInButton() {
  const { address, chain, isConnected } = useAccount()

  if (!isConnected || !address) {
    return (
      <button
        onClick={() => appKit.open()}
        className="bg-black text-white font-medium px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
      >
        Sign In
      </button>
    )
  }

  const chainName = chain?.name?.toLowerCase()

  return (
    <button
      onClick={() => appKit.open()}
      className="flex items-center justify-center"
    >
      {chainName ? (
        <img
          src={`https://icons.llama.fi/${chainName}.jpg`}
          alt=""
          className="w-7 h-7 rounded-full"
        />
      ) : (
        <span className="text-xs">?</span>
      )}
    </button>
  )
}
