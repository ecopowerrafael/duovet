import React, { useState } from 'react';
// Base44 removido: substituído por mocks/local logic
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Users, UserPlus, Crown, Stethoscope, ClipboardList, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";

export default function TeamManagement() {
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('veterinario');

  // Mock user data
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => Promise.resolve({ id: 1, name: 'Usuário Demo', email: 'demo@duovet.com' }),
  });

  // Mock accessData
  const { data: accessData } = useQuery({
    queryKey: ['organizationAccess'],
    queryFn: () => Promise.resolve({
      data: {
        organization: { id: 1, name: 'Org Demo', active_users_count: 1, max_users: 5 },
        member: { id: 1, name: 'Usuário Demo', role: 'admin' }
      }
    }),
    enabled: !!user,
  });

  const organization = accessData?.data?.organization;
  const currentMember = accessData?.data?.member;

  // Mock members
  const { data: members = [] } = useQuery({
    queryKey: ['organizationMembers', organization?.id],
    queryFn: async () => {
      if (!organization) return [];
      return [
        { id: 1, name: 'Usuário Demo', email: 'demo@duovet.com', role: 'admin' },
        { id: 2, name: 'Veterinário Demo', email: 'vet@duovet.com', role: 'veterinario' }
      ];
    },
    enabled: !!organization,
  });

  // Mock invite mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 800));
      return { email: inviteEmail, role: inviteRole };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizationMembers'] });
      toast.success('Convite enviado com sucesso!');
      setIsInviteOpen(false);
      setInviteEmail('');
    },
    onError: (error) => {
      toast.error('Erro ao enviar convite: ' + error.message);
    },
  });

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error('Digite um e-mail válido');
      return;
    }

    if (organization.active_users_count >= organization.max_users) {
      toast.error(`Limite de ${organization.max_users} usuários atingido. Faça upgrade do plano.`);
      return;
    }

    inviteMutation.mutate();
  };

  const roleConfig = {
    admin: {
      label: 'Administrador',
      icon: Crown,
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      description: 'Acesso total ao sistema'
    },
    veterinario: {
      label: 'Veterinário',
      icon: Stethoscope,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      description: 'Atendimentos e relatórios'
    },
    auxiliar: {
      label: 'Auxiliar',
      icon: ClipboardList,
      color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
      description: 'Visualização e suporte'
    }
  };

  const canManageUsers = currentMember?.role === 'admin' || currentMember?.permissions?.manage_users;

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Gerenciar Equipe</h1>
          <p className="text-[var(--text-secondary)]">
            {organization.active_users_count} de {organization.max_users} usuários ativos
          </p>
        </div>

        {canManageUsers && (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl">
                <UserPlus className="w-4 h-4 mr-2" />
                Convidar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-[var(--text-primary)]">Convidar Novo Membro</DialogTitle>
                <DialogDescription className="text-[var(--text-muted)]">
                  Envie um convite por e-mail para adicionar um novo membro à equipe
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="role">Função</Label>
                  <select
                    id="role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="veterinario">Veterinário</option>
                    <option value="auxiliar">Auxiliar</option>
                    {organization.current_plan === 'empresarial' && (
                      <option value="admin">Administrador</option>
                    )}
                  </select>
                </div>

                {organization.active_users_count >= organization.max_users && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                          Limite de usuários atingido
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                          Faça upgrade do seu plano para adicionar mais usuários
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsInviteOpen(false)}
                    className="flex-1 rounded-xl bg-white border border-black text-black hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={inviteMutation.isPending || organization.active_users_count >= organization.max_users}
                    className="flex-1 bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black rounded-xl dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-[#22c55e]/90"
                  >
                    {inviteMutation.isPending ? 'Enviando...' : 'Enviar Convite'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Plan Limit Info */}
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                Plano {organization.current_plan}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                Até {organization.max_users} usuários simultâneos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[...Array(Math.min(organization.active_users_count, 5))].map((_, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-[#22c55e] border-2 border-white dark:border-gray-800 flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                ))}
              </div>
              {organization.active_users_count > 5 && (
                <span className="text-sm text-[var(--text-muted)] ml-2">
                  +{organization.active_users_count - 5}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      <div className="grid gap-4">
        {members.map((member) => {
          const roleInfo = roleConfig[member.role];
          const RoleIcon = roleInfo.icon;
          const isOwner = member.user_id === organization.owner_id;

          return (
            <Card key={member.id} className="bg-[var(--bg-card)] border border-[var(--border-color)]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#22c55e] to-emerald-600 flex items-center justify-center">
                      <RoleIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {member.user_id}
                        {isOwner && (
                          <Badge className="ml-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            Proprietário
                          </Badge>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={roleInfo.color}>
                          {roleInfo.label}
                        </Badge>
                        <span className="text-xs text-[var(--text-muted)]">
                          {roleInfo.description}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canManageUsers && !isOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                    >
                      Gerenciar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
