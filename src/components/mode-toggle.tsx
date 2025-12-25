"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true)
  }, [])

  const cycleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    // 1. Fallback for browsers not supporting View Transition API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof document === 'undefined' || !(document as any).startViewTransition) {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        return;
    }

    // 2. Calculate transition center and radius
    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y)
    );

    // 3. Start the transition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transition = (document as any).startViewTransition(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    });

    // 4. Animate the clipping path
    transition.ready.then(() => {
        const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
        ];
        
        // Default: New content is on top (::view-transition-new)
        // We animate the new content revealing itself.
        // If going to dark (new is dark), expand dark circle.
        // If going to light (new is light), expand light circle.
        document.documentElement.animate(
            {
                clipPath: clipPath,
            },
            {
                duration: 500,
                easing: "cubic-bezier(0.25, 1, 0.5, 1)", // Standard ease-out
                // We always animate the "new" snapshot growing
                pseudoElement: "::view-transition-new(root)",
            }
        );
    });
  }

  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-9 h-9 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
        disabled
      >
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    )
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={cycleTheme}
      className="w-7 h-7 sm:w-9 sm:h-9 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
      aria-label="切换主题"
    >
      {/* Light Mode Icon */}
      <Sun className={`h-3.5 w-3.5 sm:h-[1.2rem] sm:w-[1.2rem] text-orange-500 transition-all ${theme === 'light' ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute'}`} />
      
      {/* Dark Mode Icon */}
      <Moon className={`h-3.5 w-3.5 sm:h-[1.2rem] sm:w-[1.2rem] text-blue-400 transition-all ${theme === 'dark' ? 'rotate-0 scale-100' : '-rotate-90 scale-0 absolute'}`} />
    </Button>
  )
}
