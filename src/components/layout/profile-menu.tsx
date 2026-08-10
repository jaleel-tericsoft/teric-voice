"use client";

import { User, KeyRound, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { currentUser } from "@/lib/mock-data";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Sidebar footer's account trigger — avatar, name, and email, opening a
 * menu with Profile and Change Password. Logout lives as its own button
 * next to this one in the sidebar, not nested in here. */
export function ProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
        >
          <Avatar size="sm" className="shrink-0">
            <AvatarFallback className="bg-teal text-teal-foreground font-semibold">
              {initials(currentUser.name)}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold text-sidebar-foreground">
              {currentUser.name}
            </span>
            <span className="truncate text-[11px] text-sidebar-foreground/50">
              {currentUser.email}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="text-sm font-semibold text-foreground">
            {currentUser.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {currentUser.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="px-2 py-1.5">
          <User className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem className="px-2 py-1.5">
          <KeyRound className="size-4" />
          Change Password
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
