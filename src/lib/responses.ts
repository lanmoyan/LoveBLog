import { NextResponse } from 'next/server';
import { AuthError, ForbiddenError } from '@/lib/auth';

function publicError(error: unknown): error is Error & { expose: true; status?: number } {
  return error instanceof Error && (error as { expose?: boolean }).expose === true;
}

function errorStatus(error: unknown) {
  const status = Number((error as { status?: unknown })?.status || 400);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 400;
}

export function jsonError(error: unknown, fallback = '请求失败') {
  if (error instanceof AuthError || error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (publicError(error)) {
    return NextResponse.json({ error: error.message }, { status: errorStatus(error) });
  }
  if (error instanceof Error) {
    const message = process.env.NODE_ENV === 'production' ? fallback : error.message || fallback;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ error: fallback }, { status: 400 });
}
