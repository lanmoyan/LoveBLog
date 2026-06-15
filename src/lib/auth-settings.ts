import { getSettingMap, setSetting } from '@/lib/settings';

export type OAuthProviderKey = 'github' | 'google' | 'discord' | 'qq' | 'wechat';

export type OAuthProviderPublicConfig = {
  key: OAuthProviderKey;
  name: string;
  enabled: boolean;
  clientId: string;
  hasSecret: boolean;
};

export type OAuthProviderPrivateConfig = OAuthProviderPublicConfig & {
  clientSecret: string;
};

export const oauthProviderMeta: Record<OAuthProviderKey, { name: string }> = {
  github: { name: 'GitHub' },
  google: { name: 'Google' },
  discord: { name: 'Discord' },
  qq: { name: 'QQ' },
  wechat: { name: 'WeChat' }
};

export const oauthProviderKeys = Object.keys(oauthProviderMeta) as OAuthProviderKey[];

function envName(key: OAuthProviderKey, suffix: 'ID' | 'SECRET') {
  return `OAUTH_${key.toUpperCase()}_${suffix}`;
}

function valueFrom(settings: Map<string, string>, key: string, fallback = '') {
  return String(settings.get(key) || fallback || '').trim();
}

export function oauthProvidersFromMap(settings: Map<string, string>): OAuthProviderPrivateConfig[] {
  return oauthProviderKeys.map((key) => {
    const clientId = valueFrom(settings, `oauth_${key}_client_id`, process.env[envName(key, 'ID')]);
    const clientSecret = valueFrom(settings, `oauth_${key}_client_secret`, process.env[envName(key, 'SECRET')]);
    return {
      key,
      name: oauthProviderMeta[key].name,
      enabled: settings.get(`oauth_${key}_enabled`) === '1' || (!!process.env[envName(key, 'ID')] && !!process.env[envName(key, 'SECRET')]),
      clientId,
      clientSecret,
      hasSecret: !!clientSecret
    };
  });
}

export function publicOAuthProviders(providers: OAuthProviderPrivateConfig[]): OAuthProviderPublicConfig[] {
  return providers.map(({ clientSecret: _clientSecret, ...provider }) => provider);
}

export type EmailAuthSettings = {
  registrationEmailEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  smtpPass: string;
  smtpPassConfigured: boolean;
};

export function emailAuthFromMap(settings: Map<string, string>): EmailAuthSettings {
  const smtpPass = valueFrom(settings, 'smtp_pass', process.env.SMTP_PASS);
  return {
    registrationEmailEnabled: settings.get('registration_email_enabled') === '1',
    smtpHost: valueFrom(settings, 'smtp_host', process.env.SMTP_HOST),
    smtpPort: valueFrom(settings, 'smtp_port', process.env.SMTP_PORT || '465'),
    smtpSecure: (settings.get('smtp_secure') || process.env.SMTP_SECURE || '1') !== '0',
    smtpUser: valueFrom(settings, 'smtp_user', process.env.SMTP_USER),
    smtpFrom: valueFrom(settings, 'smtp_from', process.env.SMTP_FROM || process.env.SMTP_USER),
    smtpPass,
    smtpPassConfigured: !!smtpPass
  };
}

export async function getAuthIntegrationSettings() {
  const settings = await getSettingMap();
  const oauthProviders = oauthProvidersFromMap(settings);
  const email = emailAuthFromMap(settings);
  return {
    email,
    oauthProviders,
    publicOAuthProviders: publicOAuthProviders(oauthProviders)
  };
}

export async function saveOAuthProviderSettings(providers: OAuthProviderPublicConfig[] | undefined, secrets: Record<string, string | undefined> = {}) {
  if (!Array.isArray(providers)) return;
  for (const provider of providers) {
    if (!oauthProviderKeys.includes(provider.key)) continue;
    await setSetting(`oauth_${provider.key}_enabled`, provider.enabled ? '1' : '0');
    await setSetting(`oauth_${provider.key}_client_id`, String(provider.clientId || '').trim());
    const secret = String(secrets[provider.key] || '').trim();
    if (secret) await setSetting(`oauth_${provider.key}_client_secret`, secret);
  }
}
