import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 text-center">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
        <div className="relative w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mb-8 shadow-xl">
          <FileQuestion className="w-12 h-12 text-primary" />
        </div>
      </div>
      
      <h1 className="text-4xl font-bold tracking-tight mb-2">404</h1>
      <h2 className="text-xl font-medium text-muted-foreground mb-8">
        您访问的页面不存在
      </h2>
      
      <Button asChild className="rounded-xl px-8" size="lg">
        <Link href="/">
          返回首页
        </Link>
      </Button>
    </div>
  );
}
