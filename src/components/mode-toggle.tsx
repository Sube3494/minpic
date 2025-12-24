"use client"

import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="group rounded-full bg-white/5 border-white/10 hover:bg-white/10 backdrop-blur-md">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-orange-500" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-strong border-white/10 min-w-[150px]">
        <DropdownMenuItem onClick={() => setTheme("light")} className="focus:bg-primary/10 cursor-pointer gap-2 py-2.5">
          <Sun className="w-4 h-4 text-orange-500" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="focus:bg-primary/10 cursor-pointer gap-2 py-2.5">
          <Moon className="w-4 h-4 text-blue-400" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="focus:bg-primary/10 cursor-pointer gap-2 py-2.5">
          <Laptop className="w-4 h-4 text-zinc-500" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
