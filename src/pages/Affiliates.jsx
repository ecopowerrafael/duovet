import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';
import { getAffiliateMe, getAffiliatePayouts, getAffiliateReferrals, requestAffiliatePayout, updateAffiliatePix } from '../lib/api';

function formatMoney(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function statusLabel(status) {
  if (status === 'paid') return 'Pago';
  if (status === 'pending') return 'Aguardando';
  if (status === 'requested') return 'Pendente';
  if (status === 'completed') return 'Pago';
  if (status === 'rejected') return 'Rejeitado';
  if (status === 'ineligible') return 'Não elegível';
  return status || '-';
}

export default function Affiliates() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [pixKey, setPixKey] = useState('');
  const [savingPix, setSavingPix] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [payouts, setPayouts] = useState([]);

  const subscriptionState = me?.subscription_state || 'none';
  const settings = me?.settings || { default_commission: 25, min_payout: 100 };
  const profile = me?.profile || { balance_available: 0, balance_reserved: 0, total_earned: 0 };

  const canUseAffiliateFeatures = subscriptionState === 'active';
  const canRequestPayout = useMemo(() => {
    const available = Number(profile.balance_available) || 0;
    return available >= (Number(settings.min_payout) || 0);
  }, [profile.balance_available, settings.min_payout]);

  async function refresh({ includeReferrals } = { includeReferrals: true }) {
    const meData = await getAffiliateMe();
    setMe(meData);
    setPixKey(meData?.profile?.pix_key || '');

    const payoutsData = await getAffiliatePayouts();
    setPayouts(Array.isArray(payoutsData) ? payoutsData : []);

    if (includeReferrals && meData?.subscription_state === 'active') {
      const referralsData = await getAffiliateReferrals();
      setReferrals(Array.isArray(referralsData) ? referralsData : []);
    } else {
      setReferrals([]);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Erro ao carregar afiliados'))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(me?.affiliate_link || '');
      toast.success('Link copiado!');
    } catch (e) {
      toast.error('Não foi possível copiar o link');
    }
  };

  const handleSavePix = async () => {
    setSavingPix(true);
    try {
      const updated = await updateAffiliatePix(pixKey);
      if (updated?.queued) {
        toast.warning('Sem conexão com o servidor. A alteração foi para a fila de sincronização.');
      } else {
        toast.success('Chave PIX salva!');
      }
      await refresh({ includeReferrals: false });
    } catch (e) {
      toast.error('Erro ao salvar chave PIX');
    } finally {
      setSavingPix(false);
    }
  };

  const handleRequestPayout = async () => {
    setRequestingPayout(true);
    try {
      const result = await requestAffiliatePayout();
      if (result?.queued) {
        toast.warning('Sem conexão com o servidor. A solicitação foi para a fila de sincronização.');
      } else {
        toast.success('Saque solicitado!');
      }
      await refresh({ includeReferrals: false });
    } catch (e) {
      toast.error(e?.message || 'Erro ao solicitar saque');
    } finally {
      setRequestingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (subscriptionState === 'none') {
    return (
      <div className="max-w-5xl mx-auto py-8 space-y-6">
        <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[var(--text-primary)]">Afiliados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-[var(--text-secondary)]">
              É necessário ter uma assinatura ativa para se tornar um afiliado.
            </div>
            <Button asChild className="bg-[#22c55e] hover:bg-[#16a34a] text-white">
              <Link to={createPageUrl('plans')}>Ver planos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-[var(--text-primary)]">Afiliados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(subscriptionState === 'canceled' || subscriptionState === 'expired') && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
              Sua assinatura não está ativa. Você não receberá novos pagamentos por seus links até reativar seu plano.
            </div>
          )}

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="referrals" disabled={!canUseAffiliateFeatures}>Meus Indicados</TabsTrigger>
              <TabsTrigger value="payouts">Saques</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-[var(--text-primary)]">Carteira</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-[var(--text-secondary)]">Saldo disponível</div>
                      <div className="font-semibold text-[var(--text-primary)]">{formatMoney(profile.balance_available)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-[var(--text-secondary)]">Saldo pendente</div>
                      <div className="font-semibold text-[var(--text-primary)]">{formatMoney(profile.balance_reserved)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-[var(--text-secondary)]">Total ganho</div>
                      <div className="font-semibold text-[var(--text-primary)]">{formatMoney(profile.total_earned)}</div>
                    </div>
                    <Button
                      onClick={handleRequestPayout}
                      disabled={!canRequestPayout || requestingPayout || !pixKey}
                      className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white"
                    >
                      {requestingPayout ? 'Solicitando...' : `Solicitar saque (mínimo ${formatMoney(settings.min_payout)})`}
                    </Button>
                    {!pixKey && (
                      <div className="text-xs text-[var(--text-muted)]">
                        Cadastre uma chave PIX para habilitar o saque.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-[var(--text-primary)]">Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-[var(--text-secondary)]">Chave PIX</div>
                    <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Digite sua chave PIX" />
                    <Button onClick={handleSavePix} disabled={savingPix} className="bg-[#22c55e] hover:bg-[#16a34a] text-white">
                      {savingPix ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <div className="text-xs text-[var(--text-muted)]">
                      Comissão aplicada: {Number(me?.effective_commission || settings.default_commission).toLocaleString('pt-BR')}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {canUseAffiliateFeatures && (
                <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-[var(--text-primary)]">Link de Afiliado</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col md:flex-row gap-2">
                      <Input readOnly value={me?.affiliate_link || ''} />
                      <Button onClick={handleCopyLink} variant="outline">Copiar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="referrals">
              <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-[var(--text-primary)]">Meus Indicados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-[var(--border-color)] overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Indicado</TableHead>
                          <TableHead>Data do Cadastro</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(referrals || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-[var(--text-muted)]">
                              Nenhum indicado ainda.
                            </TableCell>
                          </TableRow>
                        ) : (referrals || []).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.referred_name}</TableCell>
                            <TableCell>{formatDate(row.referred_at)}</TableCell>
                            <TableCell>{statusLabel(row.status)}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.commission_value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payouts">
              <Card className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-[var(--text-primary)]">Saques</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-[var(--text-secondary)]">
                    Valor mínimo para saque: <span className="font-semibold text-[var(--text-primary)]">{formatMoney(settings.min_payout)}</span>
                  </div>

                  <div className="rounded-md border border-[var(--border-color)] overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(payouts || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-[var(--text-muted)]">
                              Nenhuma solicitação de saque.
                            </TableCell>
                          </TableRow>
                        ) : (payouts || []).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{formatDate(row.requested_at)}</TableCell>
                            <TableCell>{statusLabel(row.status)}</TableCell>
                            <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

