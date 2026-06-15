import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings';
import {
  ensureVisitEventTable,
  normalizeVisitPayload,
  parseDevice,
  requestIpHash,
  requestRegion
} from '@/lib/visit-analytics';

const VISIT_COOKIE = 'love_next_visited';
const VISIT_MAX_AGE = 12 * 60 * 60;

function hasVisitCookie(request: Request) {
  const raw = request.headers.get('cookie') || '';
  return raw
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${VISIT_COOKIE}=1`);
}

async function readVisits() {
  return Number(await getSetting('visits', '0')) || 0;
}

async function incrementVisits() {
  await prisma.$executeRaw`
    INSERT INTO "settings" ("key", "value")
    VALUES ('visits', '1')
    ON CONFLICT("key") DO UPDATE SET "value" = CAST(CAST(COALESCE(NULLIF("settings"."value", ''), '0') AS INTEGER) + 1 AS TEXT)
  `;
  return readVisits();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const payload = normalizeVisitPayload(body);
  const userAgent = request.headers.get('user-agent') || '';
  const device = parseDevice(userAgent, payload.screen);
  await ensureVisitEventTable();

  await prisma.$executeRaw`
    INSERT INTO "visit_events" (
      "session_id",
      "path",
      "title",
      "referrer",
      "duration_ms",
      "region",
      "device_type",
      "device_detail",
      "browser",
      "os",
      "user_agent",
      "ip_hash"
    )
    VALUES (
      ${payload.sessionId},
      ${payload.path},
      ${payload.title || ''},
      ${payload.referrer || ''},
      ${Math.round(payload.durationMs || 0)},
      ${requestRegion(request)},
      ${device.deviceType},
      ${device.detail},
      ${device.browser},
      ${device.os},
      ${userAgent.slice(0, 500)},
      ${requestIpHash(request)}
    )
    ON CONFLICT ("session_id", "path") DO UPDATE SET
      "title" = COALESCE(NULLIF(EXCLUDED."title", ''), "visit_events"."title"),
      "referrer" = COALESCE(NULLIF(EXCLUDED."referrer", ''), "visit_events"."referrer"),
      "duration_ms" = GREATEST("visit_events"."duration_ms", EXCLUDED."duration_ms"),
      "region" = COALESCE(NULLIF(EXCLUDED."region", ''), "visit_events"."region"),
      "device_type" = COALESCE(NULLIF(EXCLUDED."device_type", ''), "visit_events"."device_type"),
      "device_detail" = COALESCE(NULLIF(EXCLUDED."device_detail", ''), "visit_events"."device_detail"),
      "browser" = COALESCE(NULLIF(EXCLUDED."browser", ''), "visit_events"."browser"),
      "os" = COALESCE(NULLIF(EXCLUDED."os", ''), "visit_events"."os"),
      "user_agent" = COALESCE(NULLIF(EXCLUDED."user_agent", ''), "visit_events"."user_agent"),
      "updated_at" = CURRENT_TIMESTAMP
  `;

  if (hasVisitCookie(request)) {
    return NextResponse.json({ visits: await readVisits(), counted: false });
  }

  const response = NextResponse.json({ visits: await incrementVisits(), counted: true });
  response.cookies.set(VISIT_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: VISIT_MAX_AGE,
    secure: process.env.NODE_ENV === 'production'
  });
  return response;
}
