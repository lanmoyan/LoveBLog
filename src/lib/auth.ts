import { getServerSession } from 'next-auth';
import { getAuthOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { canAdmin, isUserActive, publicUserSelect } from '@/lib/users';

export class AuthError extends Error {
  status = 401;
}

export class ForbiddenError extends Error {
  status = 403;
}

async function sessionUser() {
  const session = await getServerSession(await getAuthOptions());
  const id = Number(session?.user?.id || 0);
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  return isUserActive(user) ? user : null;
}

export async function getAuthUserFromRequest(_request: Request) {
  return sessionUser();
}

export async function requireAuthUser(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) throw new AuthError('未登录或登录已过期');
  return user;
}

export async function requireAdminUser(request: Request) {
  const user = await requireAuthUser(request);
  if (!canAdmin(user)) throw new ForbiddenError('需要管理员权限');
  return user;
}

export async function getAuthUserFromCookies() {
  return sessionUser();
}
