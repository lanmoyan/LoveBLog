import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/responses';
import { getSetting } from '@/lib/settings';
import { canAdmin } from '@/lib/users';
import { ensureVisitEventTable } from '@/lib/visit-analytics';

function toNumber(value: unknown) {
  return Number(value || 0);
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const scope = (new URL(request.url).searchParams.get('scope') || '').trim().toLowerCase();
    const personal = scope === 'mine' || !canAdmin(user);
    const [posts, likes, messages, events, wishlist, stories] = await Promise.all([
      prisma.post.count({ where: personal ? { authorId: user.id } : undefined }),
      prisma.like.count({ where: personal ? { userId: user.id } : undefined }),
      prisma.message.count({ where: personal ? { userId: user.id } : undefined }),
      personal ? Promise.resolve(0) : prisma.event.count(),
      personal ? Promise.resolve(0) : prisma.wishlistItem.count(),
      prisma.blogPost.count({ where: personal ? { authorId: user.id } : undefined })
    ]);
    const visits = Number(await getSetting('visits', '0'));
    let analytics = {};
    if (!personal) {
      await ensureVisitEventTable();
      const [summaryRows, seriesRows, pageRows, regionRows, deviceRows, recentRows] = await Promise.all([
        prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT
            COUNT(*) FILTER (WHERE "created_at" >= CURRENT_DATE)::int AS "today",
            COUNT(*) FILTER (WHERE "created_at" >= date_trunc('week', CURRENT_DATE))::int AS "week",
            COUNT(*) FILTER (WHERE "created_at" >= date_trunc('month', CURRENT_DATE))::int AS "month",
            COUNT(*) FILTER (WHERE "created_at" >= date_trunc('year', CURRENT_DATE))::int AS "year",
            COUNT(*)::int AS "total",
            COALESCE(AVG("duration_ms"), 0)::int AS "avgDuration"
          FROM "visit_events"
        `,
        prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT
            to_char(day::date, 'MM-DD') AS "label",
            COUNT(v."id")::int AS "visits"
          FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS day
          LEFT JOIN "visit_events" v
            ON v."created_at" >= day
            AND v."created_at" < day + INTERVAL '1 day'
          GROUP BY day
          ORDER BY day
        `,
        prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT
            "path",
            COUNT(*)::int AS "views",
            COALESCE(AVG("duration_ms"), 0)::int AS "avgDuration"
          FROM "visit_events"
          GROUP BY "path"
          ORDER BY "views" DESC, "path" ASC
          LIMIT 8
        `,
        prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT
            COALESCE(NULLIF("region", ''), '未知地区') AS "region",
            COUNT(*)::int AS "visits"
          FROM "visit_events"
          GROUP BY COALESCE(NULLIF("region", ''), '未知地区')
          ORDER BY "visits" DESC
          LIMIT 8
        `,
        prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT
            COALESCE(NULLIF("device_type", ''), '未知设备') AS "type",
            COUNT(*)::int AS "visits",
            COALESCE(MAX(NULLIF("device_detail", '')), '') AS "detail"
          FROM "visit_events"
          GROUP BY COALESCE(NULLIF("device_type", ''), '未知设备')
          ORDER BY "visits" DESC
        `,
        prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT
            "path",
            COALESCE(NULLIF("region", ''), '未知地区') AS "region",
            COALESCE(NULLIF("device_detail", ''), NULLIF("device_type", ''), '未知设备') AS "device",
            "duration_ms" AS "duration",
            "created_at" AS "createdAt"
          FROM "visit_events"
          ORDER BY "updated_at" DESC
          LIMIT 12
        `
      ]);
      const summary = summaryRows[0] || {};
      analytics = {
        visitSummary: {
          today: toNumber(summary.today),
          week: toNumber(summary.week),
          month: toNumber(summary.month),
          year: toNumber(summary.year),
          total: Math.max(visits, toNumber(summary.total)),
          avgDuration: toNumber(summary.avgDuration)
        },
        visitSeries: seriesRows.map((row) => ({ label: String(row.label || ''), visits: toNumber(row.visits) })),
        topPages: pageRows.map((row) => ({ path: String(row.path || '/'), views: toNumber(row.views), avgDuration: toNumber(row.avgDuration) })),
        regions: regionRows.map((row) => ({ region: String(row.region || '未知地区'), visits: toNumber(row.visits) })),
        devices: deviceRows.map((row) => ({ type: String(row.type || '未知设备'), visits: toNumber(row.visits), detail: String(row.detail || '') })),
        recentVisits: recentRows.map((row) => ({
          path: String(row.path || '/'),
          region: String(row.region || '未知地区'),
          device: String(row.device || '未知设备'),
          duration: toNumber(row.duration),
          createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || '')
        }))
      };
    }
    return NextResponse.json({
      posts,
      likes,
      messages,
      events,
      wishlist,
      stories,
      visits,
      hasSecurityCode: !!(await getSetting('security_code', '')),
      ...analytics
    });
  } catch (error) {
    return jsonError(error);
  }
}
