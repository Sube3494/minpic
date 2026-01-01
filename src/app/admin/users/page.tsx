'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Search,
  Trash2,
  Users as UsersIcon,
  MoreHorizontal,
  HardDrive,
  UserCheck,
  ShieldCheck,
  Check,
  ArrowUpDown,
  Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { UserEditDialog } from '@/components/admin/user-edit-dialog';
import { CircularProgress } from '@/components/ui/circular-progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

interface User {
  id: string;
  githubId: string;
  username: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  status: string;
  storageQuota: string;
  storageUsed: string;
  fileQuota: number;
  fileCount: number;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    totalStorage: '0',
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(role !== 'ALL' && { role }),
        ...(status !== 'ALL' && { status }),
        sortBy,
        sortOrder,
      });

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');

      const data = await res.json();
      setUsers(data.users);
      setTotal(data.pagination.total);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch {
      toast.error('加载用户列表失败');
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }, [page, debouncedSearch, role, status, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers(users.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const handleDelete = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setUserToDelete(user);
    }
  };

  const confirmDelete = async (userId: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete user');

      toast.success('用户已删除');
      fetchUsers();
      setSelectedUsers(new Set());
      setUserToDelete(null);
    } catch {
      toast.error('删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBatchDeleteClick = () => {
    if (selectedUsers.size === 0) return;
    setBatchDeleteDialogOpen(true);
  };

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      toast.success(newStatus === 'ACTIVE' ? '用户已启用' : '用户已暂停');
      fetchUsers();
    } catch {
      toast.error('状态更新失败');
    }
  };

  const executeBatchDelete = async () => {
    setDeleteLoading(true);
    const promises = Array.from(selectedUsers).map(userId =>
      fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    );

    try {
      await Promise.all(promises);
      toast.success(`成功删除 ${selectedUsers.size} 个用户`);
      fetchUsers();
      setSelectedUsers(new Set());
      setBatchDeleteDialogOpen(false);
    } catch {
      toast.error('批量删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleSelectAll = () => {
    const selectableUsers = users.filter(u => u.role !== 'ADMIN');
    if (selectedUsers.size === selectableUsers.length && selectableUsers.length > 0) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(selectableUsers.map(u => u.id)));
    }
  };

  const toggleSelect = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const formatBytes = (bytes: string) => {
    const num = Number(bytes);
    if (num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return `${(num / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Real stats from API
  const statsCards = [
    { title: '总用户数', value: stats.totalUsers.toString(), icon: UsersIcon, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: '活跃用户', value: stats.activeUsers.toString(), icon: UserCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
    { title: '管理员', value: stats.adminUsers.toString(), icon: ShieldCheck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { title: '总存储占用', value: formatBytes(stats.totalStorage), icon: HardDrive, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <PageWrapper>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/70 w-fit">用户管理</h1>
          <p className="text-muted-foreground">管理系统中的所有用户及其权限</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((stat, index) => (
            <Card key={index} className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 relative overflow-hidden group hover:translate-y-0 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-6 pb-2 relative">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate mr-2">{stat.title}</CardTitle>
                <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", stat.bg)}>
                  <stat.icon className={cn("w-3.5 h-3.5 sm:w-5 sm:h-5", stat.color)} />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 relative">
                <div className="text-xl sm:text-2xl font-bold truncate">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <Card className="glass-strong border-zinc-200/50 dark:border-white/10 shadow-lg bg-white/50 dark:bg-black/20 overflow-hidden relative transition-all duration-300 hover:translate-y-0">
          {/* Refresh Overlay */}
          <AnimatePresence>
            {refreshing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 bg-white/10 dark:bg-black/10 backdrop-blur-[2px] flex items-center justify-center"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium text-muted-foreground">更新中...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-4 sm:p-6 border-b border-border/50 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Search Box */}
              <div className="relative w-full lg:max-w-md group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <Input
                  placeholder="搜索用户名、邮箱或 GitHub ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all focus:border-primary/20 focus:ring-4 focus:ring-primary/10 rounded-xl"
                />
              </div>
              
              {/* Filters Group */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 px-3 bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 rounded-xl flex-1 justify-start sm:justify-center">
                        <UsersIcon className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                        <span className="truncate">{role === 'ALL' ? '所有角色' : role === 'ADMIN' ? '管理员' : '普通用户'}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 p-1.5 border-zinc-200/50 dark:border-white/10 bg-white/80 dark:bg-zinc-900/90 backdrop-blur-2xl rounded-2xl shadow-2xl">
                      <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">选择角色</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 mx-1" />
                      <div className="space-y-0.5 p-1">
                        {[
                          { id: 'ALL', label: '所有角色' },
                          { id: 'USER', label: '普通用户' },
                          { id: 'ADMIN', label: '管理员' }
                        ].map((item) => (
                          <DropdownMenuItem 
                            key={item.id}
                            onClick={() => { setRole(item.id); setPage(1); }}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-200",
                              role === item.id 
                                ? "bg-primary/10 text-primary" 
                                : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300"
                            )}
                          >
                            <span className="text-sm">{item.label}</span>
                            {role === item.id && <Check className="w-4 h-4" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 px-3 bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 rounded-xl flex-1 justify-start sm:justify-center">
                        <div className={cn("w-2 h-2 rounded-full mr-2 shrink-0", status === 'ALL' ? "bg-zinc-400" : status === 'ACTIVE' ? "bg-green-500" : "bg-red-500")} />
                        <span className="truncate">{status === 'ALL' ? '所有状态' : status === 'ACTIVE' ? '正常' : '暂停'}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 p-1.5 border-zinc-200/50 dark:border-white/10 bg-white/80 dark:bg-zinc-900/90 backdrop-blur-2xl rounded-2xl shadow-2xl">
                      <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">选择状态</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 mx-1" />
                      <div className="space-y-0.5 p-1">
                        {[
                          { id: 'ALL', label: '所有状态' },
                          { id: 'ACTIVE', label: '正常' },
                          { id: 'SUSPENDED', label: '暂停' }
                        ].map((item) => (
                          <DropdownMenuItem 
                            key={item.id}
                            onClick={() => { setStatus(item.id); setPage(1); }}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-200",
                              status === item.id 
                                ? "bg-primary/10 text-primary" 
                                : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                item.id === 'ALL' ? "bg-zinc-400" : item.id === 'ACTIVE' ? "bg-green-500" : "bg-red-500"
                              )} />
                              <span className="text-sm">{item.label}</span>
                            </div>
                            {status === item.id && <Check className="w-4 h-4" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 px-3 bg-zinc-50/50 dark:bg-white/5 border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 rounded-xl col-span-2 xs:flex-none">
                        <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                        <span>排序</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1.5 border-zinc-200/50 dark:border-white/10 bg-white/80 dark:bg-zinc-900/90 backdrop-blur-2xl rounded-2xl shadow-2xl">
                      <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">排序字段</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 mx-1" />
                      <div className="space-y-0.5 p-1">
                        {[
                          { id: 'createdAt', label: '注册时间' },
                          { id: 'username', label: '用户名' },
                          { id: 'storageUsed', label: '存储使用' },
                          { id: 'fileCount', label: '文件数量' },
                          { id: 'role', label: '角色' },
                          { id: 'status', label: '状态' }
                        ].map((item) => (
                          <DropdownMenuItem 
                            key={item.id}
                            onClick={() => { setSortBy(item.id); setPage(1); }}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-200",
                              sortBy === item.id 
                                ? "bg-primary/10 text-primary" 
                                : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300"
                            )}
                          >
                            <span className="text-sm">{item.label}</span>
                            {sortBy === item.id && <Check className="w-4 h-4" />}
                          </DropdownMenuItem>
                        ))}
                      </div>
                      
                      <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 mx-1" />
                      <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">排序顺序</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 mx-1" />
                      
                      <div className="space-y-0.5 p-1">
                        <DropdownMenuItem 
                          onClick={() => { setSortOrder('desc'); setPage(1); }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-200",
                            sortOrder === 'desc' 
                              ? "bg-primary/10 text-primary" 
                              : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm">降序排列</span>
                            <span className="text-[10px] opacity-60 font-normal">从新到旧 / 从大到小</span>
                          </div>
                          {sortOrder === 'desc' && <Check className="w-4 h-4" />}
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem 
                          onClick={() => { setSortOrder('asc'); setPage(1); }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-200",
                            sortOrder === 'asc' 
                              ? "bg-primary/10 text-primary" 
                              : "hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm">升序排列</span>
                            <span className="text-[10px] opacity-60 font-normal">从旧到新 / 从小到大</span>
                          </div>
                          {sortOrder === 'asc' && <Check className="w-4 h-4" />}
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {selectedUsers.size > 0 && (
                  <Button
                    variant="destructive"
                    onClick={handleBatchDeleteClick}
                    className="animate-in zoom-in-95 duration-200 h-10 px-4 rounded-xl w-full xs:w-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除选中 ({selectedUsers.size})
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="relative overflow-x-auto min-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-muted-foreground">加载中...</p>
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-20">
                <div className="bg-zinc-100 dark:bg-zinc-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                   <UsersIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium text-foreground">暂无用户</h3>
                <p className="text-muted-foreground mt-1">没有找到任何匹配的用户</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={selectedUsers.size > 0 && selectedUsers.size === users.filter(u => u.role !== 'ADMIN').length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[250px]">用户</TableHead>
                    <TableHead className="text-center">角色</TableHead>
                    <TableHead className="text-center">状态</TableHead>
                    <TableHead className="text-center">存储使用</TableHead>
                    <TableHead className="text-center">文件数</TableHead>
                    <TableHead className="text-center text-nowrap">注册时间</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {users.map((user) => (
                      <motion.tr
                        key={user.id} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors border-b border-border/50 group"
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedUsers.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id)}
                            disabled={user.role === 'ADMIN'}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 ring-2 ring-transparent group-hover:ring-primary/10 transition-all">
                              <AvatarImage src={user.avatar || undefined} />
                              <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{user.name || user.username}</p>
                              <p className="text-sm text-muted-foreground">@{user.username}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className={cn(
                              "transition-all duration-300",
                              user.role === 'ADMIN' 
                                ? "bg-primary/10 text-primary hover:bg-primary/20 shadow-sm shadow-primary/10" 
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            )}>
                              {user.role === 'ADMIN' ? '管理员' : '用户'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={user.status === 'ACTIVE'}
                              onCheckedChange={() => handleStatusToggle(user.id, user.status)}
                              disabled={user.role === 'ADMIN'}
                              className={cn(
                                "data-[state=checked]:bg-green-500",
                                user.role === 'ADMIN' && "opacity-50 cursor-not-allowed"
                              )}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <div className="cursor-pointer hover:opacity-80 transition-opacity active:scale-95 duration-200">
                                  <CircularProgress
                                    value={(Number(user.storageUsed) / Number(user.storageQuota)) * 100}
                                    size={32}
                                    strokeWidth={4}
                                    padding={2}
                                    gradient={false}
                                    showPercentage={false}
                                    className={cn(
                                      Number(user.storageUsed) / Number(user.storageQuota) > 0.9 && "[--stop-0:#ef4444] [--stop-1:#f87171]"
                                    )}
                                  />
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="top" align="center" className="w-48 p-3 border-zinc-200/50 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-2xl rounded-2xl shadow-2xl">
                                <div className="text-center space-y-1.5">
                                  <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">存储使用情况</p>
                                  <div className="text-sm">
                                    <span className="font-bold text-foreground">{formatBytes(user.storageUsed)}</span>
                                    <span className="text-muted-foreground mx-1">/</span>
                                    <span className="text-zinc-500">{formatBytes(user.storageQuota)}</span>
                                  </div>
                                  <div className="h-1 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden mt-1">
                                    <div 
                                      className={cn(
                                        "h-full transition-all duration-500",
                                        (Number(user.storageUsed) / Number(user.storageQuota)) > 0.9 ? "bg-red-500" : "bg-primary"
                                      )}
                                      style={{ width: `${Math.min(100, (Number(user.storageUsed) / Number(user.storageQuota)) * 100)}%` }}
                                    />
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    已使用 {((Number(user.storageUsed) / Number(user.storageQuota)) * 100).toFixed(1)}%
                                  </p>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <div className="cursor-pointer hover:opacity-80 transition-opacity active:scale-95 duration-200">
                                  <CircularProgress
                                    value={(user.fileCount / user.fileQuota) * 100}
                                    size={32}
                                    strokeWidth={4}
                                    padding={2}
                                    gradient={false}
                                    showPercentage={false}
                                    className={cn(
                                      user.fileCount / user.fileQuota > 0.9 
                                        ? "[--stop-0:#ef4444] [--stop-1:#f87171]" 
                                        : "[--stop-0:#3b82f6] [--stop-1:#60a5fa]"
                                    )}
                                  />
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="top" align="center" className="w-48 p-3 border-zinc-200/50 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-2xl rounded-2xl shadow-2xl">
                                <div className="text-center space-y-1.5">
                                  <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">文件数量情况</p>
                                  <div className="text-sm">
                                    <span className="font-bold text-foreground">{user.fileCount}</span>
                                    <span className="text-muted-foreground mx-1">/</span>
                                    <span className="text-zinc-500">{user.fileQuota}</span>
                                  </div>
                                  <div className="h-1 w-full bg-zinc-100 dark:bg-white/5 rounded-full overflow-hidden mt-1">
                                    <div 
                                      className={cn(
                                        "h-full transition-all duration-500",
                                        (user.fileCount / user.fileQuota) > 0.9 ? "bg-red-500" : "bg-blue-500"
                                      )}
                                      style={{ width: `${Math.min(100, (user.fileCount / user.fileQuota) * 100)}%` }}
                                    />
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    已使用 {((user.fileCount / user.fileQuota) * 100).toFixed(1)}%
                                  </p>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums text-nowrap text-muted-foreground">
                          {format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm')}
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-full transition-all">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 p-1.5 border-zinc-200/50 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-2xl rounded-2xl shadow-2xl">
                              <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">操作</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 mx-1" />
                              <div className="space-y-0.5 p-1">
                                <DropdownMenuItem 
                                  onClick={() => handleEdit(user)}
                                  className="flex items-center px-3 py-2 rounded-xl cursor-pointer hover:bg-primary/10 hover:text-primary transition-all duration-200"
                                >
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  <span className="text-sm font-medium">编辑资料</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(user.id)}
                                  disabled={user.role === 'ADMIN'}
                                  className={cn(
                                    "flex items-center px-3 py-2 rounded-xl transition-all duration-200",
                                    user.role === 'ADMIN' 
                                      ? "opacity-50 cursor-not-allowed text-muted-foreground" 
                                      : "cursor-pointer hover:bg-red-500/10 text-red-500"
                                  )}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  <span className="text-sm font-medium text-nowrap">删除用户</span>
                                </DropdownMenuItem>
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            )}
          </div>
          
          {/* Pagination */}
          {total > 0 && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                显示 {(page - 1) * 10 + 1} - {Math.min(page * 10, total)} 条，共 {total} 条
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 10 >= total}
                  className="hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Edit Dialog */}
        <UserEditDialog
          user={editingUser}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchUsers}
        />

        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除用户?</AlertDialogTitle>
              <AlertDialogDescription>
                此操作将永久删除用户 <span className="font-bold text-foreground mx-1">@{userToDelete?.username}</span> 及其所有数据。
                <br />
                这里的操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  if (userToDelete) confirmDelete(userToDelete.id);
                }}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2" />
                    删除中...
                  </>
                ) : (
                  '确认删除'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认批量删除?</AlertDialogTitle>
              <AlertDialogDescription>
                您正在试图删除 <span className="font-bold text-foreground mx-1">{selectedUsers.size}</span> 个用户。
                <br />
                此操作将永久删除这些用户及其所有数据，且<span className="text-destructive font-medium mx-1">无法撤销</span>。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  executeBatchDelete();
                }}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2" />
                    删除中...
                  </>
                ) : (
                  '确认删除'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageWrapper>
  );
}
