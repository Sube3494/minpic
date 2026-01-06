
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth-utils';

export async function POST(req: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: '请填写旧密码和新密码' }, { status: 400 });
    }

    // Relaxed Regex: At least one letter, one number, length 8+. Allows ANY non-whitespace character.
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[^\s]{8,}$/;
    
    if (!passwordRegex.test(newPassword)) {
      return NextResponse.json({ 
        error: '密码必须包含字母和数字，且长度不少于 8 位' 
      }, { status: 400 });
    }

    // Get current user password hash
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser || !dbUser.password) {
      return NextResponse.json({ error: '当前用户未设置密码或无法修改' }, { status: 400 });
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, dbUser.password);
    if (!isValid) {
      return NextResponse.json({ error: '旧密码错误' }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: '修改密码失败' }, { status: 500 });
  }
}
