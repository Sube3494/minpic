"use client"

import * as React from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DatePickerProps {
  date?: Date
  setDate: (date?: Date) => void
  placeholder?: string
  className?: string
}

export function DatePicker({ date, setDate, placeholder = "选择日期", className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full h-10 justify-start text-left font-normal border-zinc-200/50 dark:border-white/10 bg-white/50 dark:bg-white/5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 transition-all",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
          {date ? format(date, "yyyy年MM月dd日", { locale: zhCN }) : <span>{placeholder}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="p-0 border-zinc-200/50 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden"
      >
        <Calendar
          selected={date}
          onSelect={(d) => {
            setDate(d)
            setOpen(false)
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
