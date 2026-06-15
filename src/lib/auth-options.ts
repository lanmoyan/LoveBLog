import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import DiscordProvider from 'next-auth/providers/discord';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import { getAuthIntegrationSettings, type OAuthProviderPrivateConfig } from '@/lib/auth-settings';
import { prisma } from '@/lib/prisma';
import { isUserActive, publicUserSelect } from '@/lib/users';

function authSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required in production.');
  }
  return 'love-next-build-secret-change-me';
}

function cleanUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

async function uniqueUsername(base: string) {
  const seed = cleanUsername(base) || `user-${crypto.randomBytes(3).toString('hex')}`;
  for (let index = 0; index < 20; index += 1) {
    const username = index === 0 ? seed : `${seed}-${index}`;
    const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!existing) return username.slice(0, 32);
  }
  return `user-${crypto.randomBytes(6).toString('hex')}`;
}

function publicSessionUser(user: {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  avatarImage: string;
  partnerId: number | null;
  roleKey: string;
  status: string;
}) {
  return {
    id: String(user.id),
    username: user.username,
    name: user.displayName,
    displayName: user.displayName,
    avatar: user.avatar,
    avatarImage: user.avatarImage,
    partnerId: user.partnerId,
    roleKey: user.roleKey,
    status: user.status
  };
}

async function touchUser(id: number) {
  const user = await prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
    select: publicUserSelect
  });
  return publicSessionUser(user);
}

async function findOrCreateOAuthUser(provider: string, providerAccountId: string, profile: { email?: string | null; name?: string | null; image?: string | null }) {
  const linked = await prisma.userOAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: { select: publicUserSelect } }
  });
  if (linked?.user && isUserActive(linked.user)) {
    await prisma.userOAuthAccount.update({
      where: { id: linked.id },
      data: {
        email: profile.email || linked.email,
        name: profile.name || linked.name,
        avatar: profile.image || linked.avatar
      }
    });
    return touchUser(linked.user.id);
  }

  const email = String(profile.email || '').trim().toLowerCase() || null;
  const displayName = String(profile.name || email?.split('@')[0] || `${provider} 用户`).trim().slice(0, 20);
  const existingByEmail = email
    ? await prisma.user.findUnique({ where: { email }, select: publicUserSelect }).catch(() => null)
    : null;

  const user = existingByEmail || await prisma.$transaction(async (tx) => {
    const userCount = await tx.user.count();
    return tx.user.create({
      data: {
        username: await uniqueUsername(email?.split('@')[0] || displayName || provider),
        email,
        displayName,
        avatar: displayName.slice(0, 1).toUpperCase(),
        avatarImage: String(profile.image || '').slice(0, 500),
        passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
        roleKey: userCount === 0 ? 'admin' : 'user',
        lastLoginAt: new Date()
      },
      select: publicUserSelect
    });
  });

  await prisma.userOAuthAccount.upsert({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    create: {
      userId: user.id,
      provider,
      providerAccountId,
      email,
      name: displayName,
      avatar: String(profile.image || '').slice(0, 500)
    },
    update: {
      userId: user.id,
      email,
      name: displayName,
      avatar: String(profile.image || '').slice(0, 500)
    }
  });

  return touchUser(user.id);
}

function oauthProvider(provider: OAuthProviderPrivateConfig) {
  const options = { clientId: provider.clientId, clientSecret: provider.clientSecret };
  if (provider.key === 'github') return GitHubProvider(options);
  if (provider.key === 'google') return GoogleProvider(options);
  if (provider.key === 'discord') return DiscordProvider(options);
  return null;
}

export async function getAuthOptions(): Promise<NextAuthOptions> {
  const { oauthProviders } = await getAuthIntegrationSettings().catch(() => ({ oauthProviders: [] as OAuthProviderPrivateConfig[] }));
  const dynamicProviders = oauthProviders
    .filter((provider) => provider.enabled && provider.clientId && provider.clientSecret)
    .map(oauthProvider)
    .filter((provider): provider is NonNullable<typeof provider> => !!provider);

  return {
    secret: authSecret(),
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60
    },
    pages: {
      signIn: '/login/'
    },
    providers: [
      CredentialsProvider({
        name: 'Username and password',
        credentials: {
          username: { label: 'Username', type: 'text' },
          password: { label: 'Password', type: 'password' }
        },
        async authorize(credentials) {
          const username = String(credentials?.username || '').trim().toLowerCase();
          const password = String(credentials?.password || '');
          if (!username || !password) return null;

          const user = await prisma.user.findUnique({ where: { username } });
          if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
          if (!isUserActive(user)) return null;

          return touchUser(user.id);
        }
      }),
      ...dynamicProviders
    ],
    callbacks: {
      async jwt({ token, user, account, profile }) {
        const sessionUser = account && account.provider !== 'credentials'
          ? await findOrCreateOAuthUser(account.provider, account.providerAccountId, {
            email: String((profile as any)?.email || (user as any)?.email || ''),
            name: String((profile as any)?.name || (profile as any)?.login || (profile as any)?.username || user?.name || ''),
            image: String((profile as any)?.avatar_url || (profile as any)?.picture || (profile as any)?.image_url || (user as any)?.image || '')
          })
          : user;

        if (sessionUser) {
          token.userId = Number(sessionUser.id);
          token.username = sessionUser.username;
          token.displayName = sessionUser.displayName;
          token.avatar = sessionUser.avatar;
          token.avatarImage = sessionUser.avatarImage;
          token.partnerId = sessionUser.partnerId;
          token.roleKey = sessionUser.roleKey;
          token.status = sessionUser.status;
        }
        return token;
      },
      async session({ session, token }) {
        session.user = {
          ...session.user,
          id: Number(token.userId),
          username: String(token.username || ''),
          displayName: String(token.displayName || session.user?.name || ''),
          avatar: String(token.avatar || ''),
          avatarImage: String(token.avatarImage || ''),
          partnerId: typeof token.partnerId === 'number' ? token.partnerId : null,
          roleKey: String(token.roleKey || 'user'),
          status: String(token.status || 'active')
        };
        return session;
      }
    }
  };
}
