import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus, flushQueue, formatSyncErrorForUser } from '../lib/offline';
import { invalidateAppDataQueries } from '../lib/query-client';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function OfflineSyncBanner() {
  const { isOnline, pendingCount, isSyncing } = useOfflineStatus();
  const [showBanner, setShowBanner] = useState(false);
  const queryClient = useQueryClient();

  const refreshCoreData = useCallback(async () => {
    await invalidateAppDataQueries(queryClient);
  }, [queryClient]);

  useEffect(() => {
    if (!isOnline || pendingCount > 0) {
      setShowBanner(true);
    } else {
      const timer = setTimeout(() => setShowBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount]);

  useEffect(() => {
    if (!isOnline) return;
    if (pendingCount !== 0) return;
    if (isSyncing) return;
    refreshCoreData();
  }, [isOnline, pendingCount, isSyncing, refreshCoreData]);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    toast.promise(
      (async () => {
        await flushQueue({ force: true });
        await refreshCoreData();
      })(),
      {
      loading: 'Sincronizando alterações...',
      success: 'Sincronização concluída!',
      error: (err) => formatSyncErrorForUser(err)
      }
    );
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] p-2 flex justify-center pointer-events-none"
        >
          <div className={`
            pointer-events-auto
            flex items-center gap-3 px-4 py-2 rounded-full shadow-lg border
            ${isOnline 
              ? (pendingCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800')
              : 'bg-red-50 border-red-200 text-red-800'}
          `}>
            {!isOnline ? (
              <>
                <WifiOff className="w-4 h-4" />
                <span className="text-sm font-medium">Modo Offline</span>
              </>
            ) : pendingCount > 0 ? (
              <>
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{pendingCount} alterações pendentes</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-amber-800 hover:bg-amber-100"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sincronizar
                </Button>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-medium">Conectado e sincronizado</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
