import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const expired = { path: '/', maxAge: 0 };
  response.cookies.set('love_token', '', expired);
  response.cookies.set('next-auth.session-token', '', expired);
  response.cookies.set('__Secure-next-auth.session-token', '', expired);
  return response;
}
