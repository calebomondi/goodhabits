import { BotIcon, UserIcon } from "lucide-react"

type Props = {
  role: "user" | "assistant"
  content: string
}

export function AgentChatMessage({ role, content }: Props) {
  const isUser = role === "user"

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        {isUser ? <UserIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
      </div>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
        style={{ whiteSpace: "pre-wrap" }}
      >
        {content}
      </div>
    </div>
  )
}
