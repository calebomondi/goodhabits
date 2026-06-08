"use client"

import * as React from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  expiry,
  ...props
}: {
  items: {
    title: string
    value: string
  }[],
  expiry?: {
    isExpired: boolean
    date: string
  }
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <a href={'#'} className="flex items-center gap-2">
                  <span className="font-bold">{item.title}</span>
                  <span>{item.value}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem key={''}>
              <SidebarMenuButton asChild>
                <a href={'#'} className="flex items-center gap-2">
                  <span className="font-bold">{expiry?.isExpired ? "Expired" : "Expiry"}</span>
                  <span>{expiry?.date}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
