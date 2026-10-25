/** True for a PostgreSQL unique violation, however the Prisma driver adapter wraps it. */
export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string; originalCode?: string } };
  return err?.code === 'P2002' || err?.cause?.code === '23505' || err?.cause?.originalCode === '23505';
}
