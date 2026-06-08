"use client"

import { useState } from "react"
import { SendIcon, LoaderCircle } from "lucide-react"

type Props = {
  onSend: (message: string) => void
  disabled: boolean
}

export function AgentChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("")

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
  }

  return (
    <div className="flex items-center gap-2 border-t bg-background p-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        placeholder="Ask about GoodHabit..."
        disabled={disabled}
        className="flex-1 rounded-full border bg-muted/50 px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
      >
        {disabled ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <SendIcon className="size-3.5" />
        )}
      </button>
    </div>
  )
}
