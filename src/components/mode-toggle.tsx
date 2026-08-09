"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ModeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true)
  }, [])

  const cycleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Determine target theme based on REAL current theme (resolvedTheme)
    // This fixes the bug where 'system' mode prevents toggling in dark mode
    const isCurrentlyDark = resolvedTheme === 'dark';
    const nextTheme = isCurrentlyDark ? 'light' : 'dark';
    
    // 1. Fallback for browsers not supporting View Transition API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof document === 'undefined' || !(document as any).startViewTransition) {
        setTheme(nextTheme);
        return;
    }

    // 2. Calculate transition center and radius
    // Use touch-friendly coordinates or fallback to button center
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || window.innerHeight / 2;
    const endRadius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y)
    );

    // 3. Start the transition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transition = (document as any).startViewTransition(async () => {
        setTheme(nextTheme);
        
        // CRITICAL: Manually sync DOM class to ensure the View Transition 
        // snapshot captures the correct state immediately. 
        // React's batching might delay the attribute update.
        if (nextTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        // Wait for next tick to ensure theme is applied in React state
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    // 4. Animate the clipping path
    transition.ready.then(() => {
        const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
        ];
        
        document.documentElement.animate(
            {
                clipPath: clipPath,
            },
            {
                duration: 850,
                easing: "cubic-bezier(0.25, 1, 0.5, 1)", 
                pseudoElement: "::view-transition-new(root)",
            }
        );
    });
    
    // Fallback completion
    transition.finished.finally(() => {
        document.documentElement.classList.remove('transitioning-theme');
    });
    
    document.documentElement.classList.add('transitioning-theme');
  }

  // Use resolvedTheme to handle 'system' mode correctly
  const currentTheme = mounted ? resolvedTheme : 'light';

  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-7 h-7 sm:w-9 sm:h-9 rounded-full opacity-50"
        disabled
      >
        <Sun className="h-3.5 w-3.5 sm:h-[1.2rem] sm:w-[1.2rem]" />
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
      <Sun className={`h-3.5 w-3.5 sm:h-[1.2rem] sm:w-[1.2rem] text-orange-500 transition-all ${currentTheme === 'light' ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute'}`} />
      
      {/* Dark Mode Icon */}
      <Moon className={`h-3.5 w-3.5 sm:h-[1.2rem] sm:w-[1.2rem] text-blue-400 transition-all ${currentTheme === 'dark' ? 'rotate-0 scale-100' : '-rotate-90 scale-0 absolute'}`} />
    </Button>
  )
}
