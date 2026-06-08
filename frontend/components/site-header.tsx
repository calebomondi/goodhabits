import { Separator } from "@/components/ui/separator"

export function SiteHeader({
  trigger,
  rightTrigger,
}: {
  trigger?: React.ReactNode
  rightTrigger?: React.ReactNode
}) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-1 px-4 py-2 lg:gap-2 lg:px-6">
        {trigger && (
          <>
            {trigger}
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
          </>
        )}
        <h1 className="text-base font-medium">Dashboard</h1>
        <div className="ml-auto">{rightTrigger}</div>
      </div>
    </header>
  )
}
