import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/auth-options';

export const runtime = 'nodejs';

type Context = { params: Promise<{ nextauth: string[] }> };

export async function GET(request: Request, context: Context) {
  return NextAuth(request as any, context as any, await getAuthOptions());
}

export async function POST(request: Request, context: Context) {
  return NextAuth(request as any, context as any, await getAuthOptions());
}
