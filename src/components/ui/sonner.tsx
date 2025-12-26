/*
 * @Date: 2025-12-24 21:28:18
 * @Author: Sube
 * @FilePath: sonner.tsx
 * @LastEditTime: 2025-12-26 19:15:52
 * @Description: 
 */
"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  CircleXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        className: "backdrop-blur-md! shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]! dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.4),0_4px_6px_-2px_rgba(0,0,0,0.2)]! rounded-xl! border! border-white/15! dark:border-white/10!",
        classNames: {
          toast: "",
          description: "text-muted-foreground/90! text-sm! opacity-90!",
          title: "font-normal! text-sm!",
          success: "bg-white/10! dark:bg-white/10! text-emerald-700! dark:text-emerald-300!",
          error: "bg-white/10! dark:bg-white/10! text-red-700! dark:text-red-300!",
          warning: "bg-white/10! dark:bg-white/10! text-amber-700! dark:text-amber-300!",
          info: "bg-white/10! dark:bg-white/10! text-sky-700! dark:text-sky-300!",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5 text-emerald-500! dark:text-emerald-400!" />,
        info: <InfoIcon className="size-5 text-sky-500! dark:text-sky-400!" />,
        warning: <TriangleAlertIcon className="size-5 text-amber-500! dark:text-amber-400!" />,
        error: <CircleXIcon className="size-5 text-red-500! dark:text-red-400!" />,
        loading: <Loader2Icon className="size-5 animate-spin text-primary!" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
