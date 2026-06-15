import type { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      username: string;
      displayName: string;
      avatar: string;
      avatarImage: string;
      partnerId?: number | null;
      roleKey: string;
      status?: string | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    username: string;
    displayName: string;
    avatar: string;
    avatarImage: string;
    partnerId?: number | null;
    roleKey: string;
    status?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: number;
    username?: string;
    displayName?: string;
    avatar?: string;
    avatarImage?: string;
    partnerId?: number | null;
    roleKey?: string;
    status?: string | null;
  }
}
