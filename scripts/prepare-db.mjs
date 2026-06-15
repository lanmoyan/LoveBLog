if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Prisma commands will fail until PostgreSQL is configured.');
}
