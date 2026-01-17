import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { GetUserContext } from '@/server-actions/user-context';

export const dynamic = 'force-dynamic';

export default async function OrgLayout({
  children,
}: {
  children: ReactNode;
}) {
  const response = await GetUserContext();

  if (!response?.success || !response.data) {
    redirect('/');
  }

  const { user } = response.data;

  if (user?.profileType === 'contractor') {
    redirect('/');
  }

  return <>{children}</>;
}
