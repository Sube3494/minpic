import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // 检查是否登录
  if (!session?.user) {
    redirect('/auth/signin');
  }

  // 检查是否是管理员
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <div className="min-h-screen pt-20 overflow-x-hidden">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 flex items-start lg:gap-8">
        {/* Sidebar */}
        <div className="shrink-0 w-0 lg:w-72">
          <AdminSidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 py-8 min-h-[calc(100vh-10rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
