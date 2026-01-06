/*
 * @Date: 2025-12-31 20:01:18
 * @Author: Sube
 * @FilePath: markdown-text.tsx
 * @LastEditTime: 2026-01-07 00:37:45
 * @Description: 
 */
'use client';

import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  content: string;
  className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
  if (!content) return null;

  // Split by bold patterns
  const parts = content.split(/(\*\*.*?\*\*)/g);

  return (
    <span className={cn("block", className)}>
      {parts.map((part, index) => {
        // Handle bold: **text**
        if (part.startsWith('**') && part.endsWith('**')) {
          const text = part.slice(2, -2);
          return (
            <strong 
              key={index} 
              className="font-bold bg-linear-to-r from-primary via-blue-500 to-purple-500 bg-clip-text text-transparent! inline-block sm:mx-1"
            >
              {text}
            </strong>
          );
        }
        
        // Handle normal text and inner line breaks (\n will work due to whitespace-pre-wrap)
        return (
          <span key={index} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </span>
  );
}
