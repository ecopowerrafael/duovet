import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  Trash2,
  AlertTriangle,
  CloudUpload
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { getPendingMutations, flushQueue, removeMutation, clearQueue, clearQueuedMutationsByUrl, useNetworkStatus } from '../lib/offline';
import { invalidateAppDataQueries } from '../lib/query-client';

const STATUS_CONFIG = {
  pending: { 
    label: 'Pendente', 
    icon: Clock, 
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    iconColor: 'text-amber-400'
  },
  syncing: { 
    label: 'Sincronizando', 
    icon: RefreshCw, 
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    iconColor: 'text-blue-400'
  },
  synced: { 
    label: 'Sincronizado', 
    icon: CheckCircle, 
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    iconColor: 'text-emerald-400'
  },
  failed: { 
    label: 'Falhou', 
    icon: XCircle, 
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    iconColor: 'text-red-400'
  }
};

const ACTION_LABELS = { POST: 'Criar', PUT: 'Atualizar', DELETE: 'Excluir' };

function getEntityFromUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    const segs = u.pathname.split('/').filter(Boolean);
    const first = segs[1] || segs[0] || '';
    switch (first) {
      case 'appointments': return 'Atendimento';
      case 'animals': return 'Animal';
      case 'clients': return 'Cliente';
      case 'properties': return 'Propriedade';
      case 'payments': return 'Pagamento';
      case 'protocols': return 'Protocolo';
      case 'subscriptions': return 'Assinatura';
      case 'users': return 'Usuário';
      case 'settings': return 'Configuração';
      default: return first || 'Recurso';
    }
  } catch {
    return 'Recurso';
  }
}

export default function SyncStatus() {
  const isOnlineHook = useNetworkStatus();
  const [isOnline, setIsOnline] = useState(isOnlineHook);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    setIsOnline(isOnlineHook);
  }, [isOnlineHook]);

  const { data: syncQueue = [], isLoading } = useQuery({
    queryKey: ['syncQueue'],
    queryFn: () => Promise.resolve(getPendingMutations()),
  });

  const pendingItems = syncQueue;
  const failedItems = syncQueue.filter(item => (item.attempts || 0) > 0);
  const syncedItems = [];

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('Você está offline. Conecte-se à internet para sincronizar.');
      return;
    }

    setIsSyncing(true);
    try {
      await flushQueue({ force: true });
      await invalidateAppDataQueries(queryClient);
      toast.success('Fila sincronizada!');
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteItem = async (id) => {
    const ok = await removeMutation(id);
    if (ok) {
      queryClient.invalidateQueries({ queryKey: ['syncQueue'] });
      toast.success('Item removido da fila');
    }
  };

  const clearAll = async () => {
    await clearQueue();
    queryClient.invalidateQueries({ queryKey: ['syncQueue'] });
    toast.success('Fila limpa');
  };

  const clearSettingsStaleQueue = async () => {
    const removed = await clearQueuedMutationsByUrl('/api/settings');
    if (removed > 0) {
      queryClient.invalidateQueries({ queryKey: ['syncQueue'] });
      toast.success(`${removed} pendência(s) antiga(s) de configurações removida(s).`);
      return;
    }
    toast.info('Não há pendências antigas de configurações.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Sincronização</h1>
          <p className="text-[var(--text-muted)] mt-1">Gerencie registros pendentes de sincronização</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Online Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
            isOnline 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {isOnline ? (
              <>
                <Wifi className="w-5 h-5" />
                <span className="font-medium">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5" />
                <span className="font-medium">Offline</span>
              </>
            )}
          </div>
          
          <Button
            onClick={handleSync}
            disabled={!isOnline || isSyncing || pendingItems.length === 0}
            className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-medium rounded-xl gap-2 h-12 px-6"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{pendingItems.length}</p>
              <p className="text-sm text-[var(--text-muted)]">Pendentes</p>
            </div>
          </div>
        </div>
        
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{failedItems.length}</p>
              <p className="text-sm text-[var(--text-muted)]">Com Falha</p>
            </div>
          </div>
        </div>
        
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--text-primary)]">{syncedItems.length}</p>
              <p className="text-sm text-[var(--text-muted)]">Sincronizados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Offline Message */}
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-400">Você está offline</p>
            <p className="text-amber-400/70 text-sm mt-1">
              Os registros criados enquanto você estiver offline serão salvos localmente e sincronizados automaticamente quando você se reconectar à internet.
            </p>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">Fila de Sincronização</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSettingsStaleQueue}
              className="text-[var(--text-muted)] hover:text-amber-400 gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Limpar pendências de configurações
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={syncQueue.length === 0}
              className="text-[var(--text-muted)] hover:text-red-400 gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Fila
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[var(--text-muted)]" />
          </div>
        ) : syncQueue.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CloudUpload className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-primary)] font-medium">Tudo sincronizado!</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">Não há registros pendentes</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {syncQueue.map((item, index) => {
              const hasAttempts = (item.attempts || 0) > 0;
              const statusConfig = hasAttempts ? STATUS_CONFIG.failed : STATUS_CONFIG.pending;
              const StatusIcon = statusConfig.icon;
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 flex items-center gap-4"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusConfig.color.split(' ')[0]}`}>
                    <StatusIcon className={`w-5 h-5 ${statusConfig.iconColor}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {ACTION_LABELS[item.method]} {getEntityFromUrl(item.url)}
                      </span>
                      <Badge className={`${statusConfig.color} border text-xs`}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] truncate">
                      {hasAttempts 
                        ? `Tentativas: ${item.attempts} • Próxima: ${item.nextAttemptAt ? format(new Date(item.nextAttemptAt), "d 'de' MMM 'às' HH:mm", { locale: ptBR }) : 'agora'}`
                        : format(new Date(item.addedAt), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteItem(item.id)}
                    className="rounded-xl"
                  >
                    Remover
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
