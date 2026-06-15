import { NextResponse } from 'next/server';
import { getAuthIntegrationSettings } from '@/lib/auth-settings';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const [{ email, publicOAuthProviders }, userCount] = await Promise.all([
    getAuthIntegrationSettings(),
    prisma.user.count().catch(() => 0)
  ]);

  return NextResponse.json({
    emailVerificationEnabled: userCount > 0 && email.registrationEmailEnabled,
    oauthProviders: publicOAuthProviders.filter((provider) => provider.enabled && provider.clientId && provider.hasSecret)
  });
}
