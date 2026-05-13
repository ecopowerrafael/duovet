import React from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '../ui/badge';
// import { base44 } from '@/api/base44Client'; // Removido
import { createPageUrl } from '../../utils';

export default function NotificationBell() {
  // Exemplo: buscar notificações do backend próprio
  // const { data: notifications = [] } = useQuery({
  //   queryKey: ['notifications'],
  //   queryFn: async () => fetch('/api/notifications').then(res => res.json()),
  //   refetchInterval: 60000
  // });

  // Badge estático para exemplo
  const unreadCount = 0;

  return (
    <a
      href={createPageUrl('Notifications')}
      className="relative p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
    >
      <Bell className="w-5 h-5 text-[var(--text-primary)]" />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 bg-red-500 text-white border-0 px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center text-xs">
          {unreadCount}
        </Badge>
      )}
    </a>
  );
}