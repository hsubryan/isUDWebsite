import { NextResponse } from 'next/server';
import { syncNewContentToDb2 } from '@/lib/db2Sync';

// Triggered nightly by the Vercel Cron Job defined in vercel.json. Vercel
// sends `Authorization: Bearer ${CRON_SECRET}` on cron-triggered requests -
// see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await syncNewContentToDb2();
  console.log('[sync-db2]', summary);
  return NextResponse.json(summary);
}
