export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatar: true,
  avatarImage: true,
  partnerId: true,
  roleKey: true,
  status: true,
  lastLoginAt: true,
  createdAt: true
} as const;

export type UserRole = {
  key: string;
  name: string;
  canAdmin: boolean;
};

export const DEFAULT_USER_ROLES: UserRole[] = [
  { key: 'admin', name: '管理员', canAdmin: true },
  { key: 'user', name: '普通用户', canAdmin: false },
  { key: 'member', name: '会员用户', canAdmin: false }
];

export const USER_STATUSES = ['active', 'banned'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export function normalizeUserStatus(value: unknown): UserStatus {
  return value === 'banned' ? 'banned' : 'active';
}

export function userStatusLabel(value: unknown) {
  return normalizeUserStatus(value) === 'banned' ? '已封禁' : '正常';
}

export function normalizeRoleKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

export function normalizeUserRoles(value: unknown): UserRole[] {
  const raw = Array.isArray(value) ? value : DEFAULT_USER_ROLES;
  const roles = raw
    .map((item) => {
      const record = item as Record<string, unknown>;
      const key = normalizeRoleKey(record.key);
      const name = String(record.name || record.label || key).trim().slice(0, 24);
      return key && name ? { key, name, canAdmin: key === 'admin' || record.canAdmin === true } : null;
    })
    .filter((item): item is UserRole => !!item);
  const map = new Map<string, UserRole>();
  for (const role of roles) map.set(role.key, role.key === 'admin' ? { ...role, canAdmin: true } : role);
  for (const role of DEFAULT_USER_ROLES.filter((item) => item.key === 'admin' || item.key === 'user')) {
    if (!map.has(role.key)) map.set(role.key, role);
  }
  return Array.from(map.values());
}

export function roleName(roles: UserRole[], key: string) {
  return roles.find((role) => role.key === key)?.name || key || '普通用户';
}

export function canAdmin(user: { roleKey?: string | null } | null | undefined) {
  return user?.roleKey === 'admin';
}

export function publicUserProfile<T extends { status?: unknown; lastLoginAt?: unknown }>(user: T) {
  const { status: _status, lastLoginAt: _lastLoginAt, ...profile } = user;
  return profile;
}

export function isUserActive(user: { status?: string | null } | null | undefined) {
  return normalizeUserStatus(user?.status) === 'active';
}

export function qqAvatar(qq: string, size = 100) {
  return `https://q1.qlogo.cn/g?b=qq&nk=${encodeURIComponent(qq)}&s=${size}`;
}
