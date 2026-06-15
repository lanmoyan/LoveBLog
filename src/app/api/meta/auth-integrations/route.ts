import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthIntegrationSettings, oauthProviderKeys, saveOAuthProviderSettings } from '@/lib/auth-settings';
import { requireAdminUser } from '@/lib/auth';
import { jsonError } from '@/lib/responses';
import { setSetting } from '@/lib/settings';

const OAuthProviderSchema = z.object({
  key: z.enum(oauthProviderKeys as [string, ...string[]]),
  enabled: z.boolean().optional(),
  clientId: z.string().trim().max(300).optional(),
  clientSecret: z.string().trim().max(500).optional()
});

const AuthIntegrationSchema = z.object({
  registrationEmailEnabled: z.boolean().optional(),
  smtpHost: z.string().trim().max(200).optional(),
  smtpPort: z.string().trim().max(8).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().trim().max(200).optional(),
  smtpFrom: z.string().trim().max(240).optional(),
  smtpPass: z.string().trim().max(500).optional(),
  oauthProviders: z.array(OAuthProviderSchema).optional()
});

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const { email, publicOAuthProviders } = await getAuthIntegrationSettings();
    return NextResponse.json({
      registrationEmailEnabled: email.registrationEmailEnabled,
      smtpHost: email.smtpHost,
      smtpPort: email.smtpPort,
      smtpSecure: email.smtpSecure,
      smtpUser: email.smtpUser,
      smtpFrom: email.smtpFrom,
      smtpPassConfigured: email.smtpPassConfigured,
      oauthProviders: publicOAuthProviders
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminUser(request);
    const parsed = AuthIntegrationSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: '认证配置格式不正确' }, { status: 400 });
    const data = parsed.data;

    if (typeof data.registrationEmailEnabled === 'boolean') await setSetting('registration_email_enabled', data.registrationEmailEnabled ? '1' : '0');
    if (typeof data.smtpHost === 'string') await setSetting('smtp_host', data.smtpHost);
    if (typeof data.smtpPort === 'string') await setSetting('smtp_port', data.smtpPort || '465');
    if (typeof data.smtpSecure === 'boolean') await setSetting('smtp_secure', data.smtpSecure ? '1' : '0');
    if (typeof data.smtpUser === 'string') await setSetting('smtp_user', data.smtpUser);
    if (typeof data.smtpFrom === 'string') await setSetting('smtp_from', data.smtpFrom);
    if (typeof data.smtpPass === 'string' && data.smtpPass.trim()) await setSetting('smtp_pass', data.smtpPass.trim());

    const secretMap = Object.fromEntries((data.oauthProviders || []).map((provider) => [provider.key, provider.clientSecret || '']));
    await saveOAuthProviderSettings((data.oauthProviders || []).map((provider) => ({
      key: provider.key as any,
      name: provider.key,
      enabled: provider.enabled === true,
      clientId: provider.clientId || '',
      hasSecret: !!provider.clientSecret
    })), secretMap);

    const { email, publicOAuthProviders } = await getAuthIntegrationSettings();
    return NextResponse.json({
      registrationEmailEnabled: email.registrationEmailEnabled,
      smtpHost: email.smtpHost,
      smtpPort: email.smtpPort,
      smtpSecure: email.smtpSecure,
      smtpUser: email.smtpUser,
      smtpFrom: email.smtpFrom,
      smtpPassConfigured: email.smtpPassConfigured,
      oauthProviders: publicOAuthProviders
    });
  } catch (error) {
    return jsonError(error);
  }
}
