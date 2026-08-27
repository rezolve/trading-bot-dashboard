'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateBotRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to fleet - bot creation is disabled
    router.replace('/dashboard/fleet');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}
