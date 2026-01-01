"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { 
  addMonths, 
  subMonths, 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isToday
} from "date-fns"
import { zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date) => void
  className?: string
}

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date())

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })
  const weekDays = ["一", "二", "三", "四", "五", "六", "日"]

  return (
    <div className={cn("p-4 w-[280px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold tabular-nums">
          {format(currentMonth, "yyyy年MM月", { locale: zhCN })}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10"
            onClick={prevMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10"
            onClick={nextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* WeekDays */}
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 text-center uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const isSelected = selected && isSameDay(day, selected)
          const isCurrentMonth = isSameMonth(day, monthStart)
          const isDayToday = isToday(day)

          return (
            <button
              key={idx}
              onClick={() => onSelect?.(day)}
              className={cn(
                "h-8 w-8 text-xs rounded-lg transition-all duration-200 flex items-center justify-center relative",
                !isCurrentMonth && "text-zinc-300 dark:text-zinc-600",
                isSelected 
                  ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 scale-105 z-10" 
                  : "hover:bg-zinc-100 dark:hover:bg-white/10",
                isDayToday && !isSelected && "text-primary font-bold after:content-[''] after:absolute after:bottom-1 after:w-1 after:h-1 after:bg-primary after:rounded-full"
              )}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-[11px] h-7 px-2 text-zinc-500 hover:text-red-500"
          onClick={() => onSelect?.(undefined as any)}
        >
          清除
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-[11px] h-7 px-2 text-primary font-semibold"
          onClick={() => {
            const today = new Date()
            setCurrentMonth(today)
            onSelect?.(today)
          }}
        >
          今天
        </Button>
      </div>
    </div>
  )
}
