import { NextResponse } from 'next/server';
import { getSiteSnapshot } from '@/lib/site';

export async function GET() {
  const snapshot = await getSiteSnapshot();
  return NextResponse.json(snapshot);
}
