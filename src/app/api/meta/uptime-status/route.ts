import { NextResponse } from 'next/server';
import { getSettingMap } from '@/lib/settings';

export const dynamic = 'force-dynamic';

type StatusValue = 'up' | 'down' | 'degraded' | 'unknown';

function statusFromText(value: unknown): StatusValue {
  const text = String(value || '').toLowerCase();
  if (!text) return 'unknown';
  if (/(down|offline|outage|failed|failure|unavailable|critical|异常|故障|中断)/i.test(text)) return 'down';
  if (/(degraded|partial|maintenance|incident|warning|slow|波动|维护|部分)/i.test(text)) return 'degraded';
  if (/(up|ok|online|operational|normal|healthy|success|正常|可用)/i.test(text)) return 'up';
  return 'unknown';
}

function statusFromJson(value: unknown, depth = 0): StatusValue {
  if (depth > 4 || value == null) return 'unknown';
  if (typeof value === 'boolean') return value ? 'up' : 'down';
  if (typeof value === 'string' || typeof value === 'number') return statusFromText(value);
  if (Array.isArray(value)) {
    const results = value.map((item) => statusFromJson(item, depth + 1)).filter((item) => item !== 'unknown');
    if (results.includes('down')) return 'down';
    if (results.includes('degraded')) return 'degraded';
    return results.includes('up') ? 'up' : 'unknown';
  }
  if (typeof value !== 'object') return 'unknown';

  const record = value as Record<string, unknown>;
  const priorityKeys = ['status', 'state', 'message', 'overall', 'ok', 'up', 'online', 'operational', 'healthy'];
  for (const key of priorityKeys) {
    if (key in record) {
      const result = statusFromJson(record[key], depth + 1);
      if (result !== 'unknown') return result;
    }
  }

  const nested = Object.values(record).map((item) => statusFromJson(item, depth + 1)).filter((item) => item !== 'unknown');
  if (nested.includes('down')) return 'down';
  if (nested.includes('degraded')) return 'degraded';
  return nested.includes('up') ? 'up' : 'unknown';
}

function labelFromStatus(status: StatusValue) {
  if (status === 'up') return '所有业务正常';
  if (status === 'degraded') return '部分业务波动';
  if (status === 'down') return '站点状态异常';
  return '状态检测中';
}

export async function GET() {
  const settings = await getSettingMap();
  const statusUrl = settings.get('footer_uptime_status_url') || '';
  const statusPageUrl = settings.get('footer_uptime_status_page_url') || '';

  if (!statusUrl) {
    return NextResponse.json({ configured: false, status: 'unknown', ok: false, label: '' }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(statusUrl, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json,text/plain,image/svg+xml,*/*' }
    });
    const text = await response.text();
    let status: StatusValue = response.ok ? 'unknown' : 'down';

    if (response.ok) {
      try {
        status = statusFromJson(JSON.parse(text));
      } catch {
        status = statusFromText(text);
      }
    }

    if (status === 'unknown' && response.ok) status = 'up';

    return NextResponse.json({
      configured: true,
      ok: status === 'up',
      status,
      label: labelFromStatus(status),
      statusPageUrl,
      checkedAt: new Date().toISOString()
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch {
    return NextResponse.json({
      configured: true,
      ok: false,
      status: 'down',
      label: labelFromStatus('down'),
      statusPageUrl,
      checkedAt: new Date().toISOString()
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } finally {
    clearTimeout(timeout);
  }
}
