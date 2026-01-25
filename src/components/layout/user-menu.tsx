/*
 * @Date: 2025-12-30 00:02:29
 * @Author: Sube
 * @FilePath: user-menu.tsx
 * @LastEditTime: 2025-12-31 21:17:51
 * @Description: 
 */
'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { LogOut, User, Shield, Users, FolderOpen } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string;
    role?: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const displayName = user.name || user.username || user.email || 'User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 transition-all duration-300 outline-none shrink-0 z-10 group">
        <Avatar className="w-6 h-6 sm:w-7 sm:h-7 ring-2 ring-transparent group-hover:ring-primary/50 transition-all duration-300">
          <AvatarImage src={user.image || undefined} alt={displayName} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-56 mt-2 glass-strong animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <div className="text-sm font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              {displayName}
              {user.role === 'ADMIN' && (
                <span className="px-1.5 py-0.5 text-[9px] leading-none bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-sm font-bold">
                  管理员
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" />
            <span>个人资料</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/teams">
            <Users className="mr-2 h-4 w-4" />
            <span>团队管理</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/collections">
            <FolderOpen className="mr-2 h-4 w-4" />
            <span>我的合集</span>
          </Link>
        </DropdownMenuItem>
        
        {user.role === 'ADMIN' && (
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/admin/dashboard">
              <Shield className="mr-2 h-4 w-4" />
              <span>管理后台</span>
            </Link>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>登出</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
