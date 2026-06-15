import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettingMap, readUserRolesFromMap, setSetting } from '@/lib/settings';
import { jsonError } from '@/lib/responses';
import { normalizeRoleKey, normalizeUserRoles, normalizeUserStatus, publicUserSelect, roleName, userStatusLabel } from '@/lib/users';

function serializeUsers<T extends { roleKey: string; status?: string | null }>(roles: ReturnType<typeof readUserRolesFromMap>, users: T[]) {
  return users.map((user) => ({
    ...user,
    roleName: roleName(roles, user.roleKey),
    statusLabel: userStatusLabel(user.status)
  }));
}

async function usersPayload() {
  const settings = await getSettingMap();
  const roles = readUserRolesFromMap(settings);
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: publicUserSelect });
  return {
    roles,
    users: serializeUsers(roles, users)
  };
}

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const settings = await getSettingMap();
    const roles = readUserRolesFromMap(settings);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: publicUserSelect
    });
    return NextResponse.json({
      roles,
      users: serializeUsers(roles, users)
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json().catch(() => ({}));
    const settings = await getSettingMap();
    let roles = readUserRolesFromMap(settings);

    if (Array.isArray(body.roles)) {
      roles = normalizeUserRoles(body.roles);
      await setSetting('user_roles_json', JSON.stringify(roles));
      const roleKeys = roles.map((role) => role.key);
      const fallbackRole = roles.find((role) => role.key !== 'admin')?.key || 'user';
      await prisma.user.updateMany({
        where: { roleKey: { notIn: roleKeys } },
        data: { roleKey: fallbackRole }
      });
    }

    const userId = Number(body.userId || body.user_id || 0);
    const roleValue = body.roleKey ?? body.role_key;
    const statusValue = body.status ?? body.user_status;
    const hasRoleUpdate = typeof roleValue === 'string';
    const hasStatusUpdate = typeof statusValue === 'string';
    const nextRoleKey = hasRoleUpdate ? normalizeRoleKey(roleValue) : '';
    const nextStatus = hasStatusUpdate ? normalizeUserStatus(statusValue) : null;

    if (userId > 0 && (hasRoleUpdate || hasStatusUpdate)) {
      if (hasRoleUpdate && !nextRoleKey) {
        return NextResponse.json({ error: '用户分组不能为空' }, { status: 400 });
      }
      if (hasRoleUpdate && !roles.some((role) => role.key === nextRoleKey)) {
        return NextResponse.json({ error: '用户分组不存在' }, { status: 400 });
      }
      const target = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
      if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

      const removingAdminRole = hasRoleUpdate && target.roleKey === 'admin' && nextRoleKey !== 'admin';
      const banningAdmin = target.roleKey === 'admin' && nextStatus === 'banned';
      if (removingAdminRole || banningAdmin) {
        const adminCount = await prisma.user.count({ where: { roleKey: 'admin', status: 'active' } });
        if (adminCount <= 1) return NextResponse.json({ error: '至少保留一个管理员账号' }, { status: 400 });
      }
      if (target.id === admin.id && hasRoleUpdate && nextRoleKey !== 'admin') {
        return NextResponse.json({ error: '不能移除自己的管理员权限' }, { status: 400 });
      }
      if (target.id === admin.id && nextStatus === 'banned') {
        return NextResponse.json({ error: '不能封禁自己的账号' }, { status: 400 });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(hasRoleUpdate ? { roleKey: nextRoleKey } : {}),
          ...(nextStatus ? { status: nextStatus } : {})
        }
      });
    }

    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: publicUserSelect });
    return NextResponse.json({
      roles,
      users: serializeUsers(roles, users)
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdminUser(request);
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const userId = Number(body.userId || body.user_id || url.searchParams.get('userId') || 0);
    if (!userId) return NextResponse.json({ error: '请选择要删除的用户' }, { status: 400 });
    if (userId === admin.id) return NextResponse.json({ error: '不能删除自己的账号' }, { status: 400 });

    const target = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
    if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    if (target.roleKey === 'admin' && target.status === 'active') {
      const adminCount = await prisma.user.count({ where: { roleKey: 'admin', status: 'active' } });
      if (adminCount <= 1) return NextResponse.json({ error: '至少保留一个管理员账号' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json(await usersPayload());
  } catch (error) {
    return jsonError(error);
  }
}
