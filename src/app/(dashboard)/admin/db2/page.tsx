import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import AdminDb2Client from '@/components/AdminDb2Client';
import { authOptions } from '@/lib/auth';

export default async function Db2Page() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if ((session.user as any).role !== 'ADMIN') {
    redirect('/');
  }

  return <AdminDb2Client />;
}
