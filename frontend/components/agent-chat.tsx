"use client"

import { useState, useRef, useEffect } from "react"
import { BotIcon, XIcon } from "lucide-react"
import { AgentChatMessage } from "./agent-chat-message"
import { AgentChatInput } from "./agent-chat-input"

type Message = {
  role: "user" | "assistant"
  content: string
}

type ChatResponse = {
  reply: string
  suggested_actions?: string[]
}

type Props = {
  address: string | undefined
}

export function AgentChat({ address }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your GoodHabit Assistant! I can help you understand GoodHabit, check your current position, plan your savings/investment strategy, and answer questions about GoodDollar, UBI, savings, and investments. What would you like to know?" },
  ])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSend = async (text: string) => {
    const userMsg: Message = { role: "user", content: text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address ?? "0x0000000000000000000000000000000000000000",
          message: text,
          history,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data: ChatResponse = await res.json()
      const assistantMsg: Message = { role: "assistant", content: data.reply }

      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that request. Please try again." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
        >
          <BotIcon className="size-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex w-[360px] h-[80vh] max-h-[700px] flex-col rounded-xl border bg-background shadow-xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <BotIcon className="size-4 text-primary" />
              <span className="text-sm font-heading font-medium">GoodHabit Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <AgentChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {loading && (
              <AgentChatMessage
                role="assistant"
                content="Thinking..."
              />
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <AgentChatInput onSend={handleSend} disabled={loading} />
        </div>
      )}
    </>
  )
}
