import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  MapPin,
  Navigation,
  RotateCw
} from 'lucide-react';
import { toast } from 'sonner';
import { offlineFetch, enqueueMutation, isOnline } from '../lib/offline';
import { useAuth } from '../lib/AuthContextJWT';
import { compareIds, deepClean } from '../lib/utils';

export default function Properties() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const { user } = useAuth();

  const handleCepSearch = async (cep) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    if (!isOnline()) {
      toast.error('Você precisa estar online para buscar o CEP automaticamente');
      return;
    }

    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      setFormData(prev => ({
        ...prev,
        city: data.localidade,
        state: data.uf,
        address: `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}`
      }));
      toast.success('Endereço preenchido automaticamente');
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsSearchingCep(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    client_id: '',
    address: '',
    city: '',
    state: '',
    distance_km: '',
    coordinates: '',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: properties = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['properties', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/properties' : `/api/properties?created_by=${email || ''}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ['clients', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/clients' : `/api/clients?created_by=${email || ''}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { refetch: refetchAnimals } = useQuery({
    queryKey: ['animals', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/animals' : `/api/animals?created_by=${email || ''}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const { refetch: refetchAppointments } = useQuery({
    queryKey: ['appointments', user?.email],
    queryFn: async () => {
      const email = user?.email;
      const isAdmin = email === 'admin@duovet.app';
      const url = isAdmin ? '/api/appointments' : `/api/appointments?created_by=${email || ''}`;
      return offlineFetch(url);
    },
    enabled: !!user?.email
  });

  const handleManualRefresh = async () => {
    toast.promise(
      Promise.all([
        refetch(),
        refetchClients(),
        refetchAnimals(),
        refetchAppointments()
      ]),
      {
        loading: 'Atualizando dados...',
        success: 'Dados atualizados com sucesso!',
        error: 'Erro ao atualizar dados'
      }
    );
  };

  const createProperty = useMutation({
    mutationFn: async () => {
      const payload = deepClean({ ...formData, created_by: user?.email }) || {};
      return enqueueMutation('/api/properties', { method: 'POST', body: payload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await Promise.all([
        refetch(),
        refetchClients(),
        refetchAnimals(),
        refetchAppointments()
      ]);

      toast.success(res?.queued ? 'Propriedade enfileirada para sincronização' : 'Propriedade cadastrada com sucesso!');
      handleCloseDialog();
    },
    onError: (error) => {
      console.error('Create property error:', error);
      toast.error('Erro ao cadastrar propriedade. Tente novamente.');
    }
  });

  const updateProperty = useMutation({
    mutationFn: async () => {
      const propertyId = editingProperty?.id || editingProperty?._id;
      if (!propertyId) throw new Error('ID da propriedade não encontrado');
      const payload = deepClean(formData) || {};
      return enqueueMutation(`/api/properties/${propertyId}`, { method: 'PUT', body: payload });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await Promise.all([
        refetch(),
        refetchClients(),
        refetchAnimals(),
        refetchAppointments()
      ]);

      toast.success(res?.queued ? 'Atualização enfileirada para sincronização' : 'Propriedade atualizada com sucesso!');
      handleCloseDialog();
    },
    onError: (error) => {
      console.error('Update property error:', error);
      toast.error('Erro ao atualizar propriedade. Tente novamente.');
    }
  });

  const deleteProperty = useMutation({
    mutationFn: async (id) => {
      if (!id) throw new Error('ID da propriedade não fornecido');
      return enqueueMutation(`/api/properties/${id}`, { method: 'DELETE' });
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['animals'] });
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      
      await Promise.all([
        refetch(),
        refetchClients(),
        refetchAnimals(),
        refetchAppointments()
      ]);

      toast.success(res?.queued ? 'Remoção enfileirada para sincronização' : 'Propriedade removida com sucesso!');
    },
    onError: (error) => {
      console.error('Delete property error:', error);
      toast.error('Erro ao remover propriedade. Tente novamente.');
    }
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('new') === 'true') {
      const clientId = urlParams.get('client_id');
      if (clientId) {
        setFormData(prev => ({ ...prev, client_id: clientId }));
      }
      setIsOpen(true);
    }
  }, []);

  const handleCloseDialog = () => {
    setIsOpen(false);
    setEditingProperty(null);
    setFormData({
      name: '',
      client_id: '',
      address: '',
      city: '',
      state: '',
      distance_km: '',
      coordinates: '',
      notes: ''
    });
  };

  const handleEdit = (property) => {
    if (!property) return;
    setEditingProperty(property);
    setFormData({
      name: property.name || '',
      client_id: property.client_id ? String(property.client_id) : '',
      address: property.address || '',
      city: property.city || '',
      state: property.state || '',
      distance_km: property.distance_km !== undefined && property.distance_km !== null ? String(property.distance_km) : '',
      coordinates: property.coordinates || '',
      notes: property.notes || ''
    });
    setIsOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingProperty) {
      updateProperty.mutate();
    } else {
      createProperty.mutate();
    }
  };

  const getClientName = (clientId) => {
    if (!clientId) return '-';
    const client = (clients || []).find(c => compareIds(c.id || c._id, clientId));
    return client?.name || '-';
  };

  const filteredProperties = (properties || []).filter(property => {
    if (!property) return false;
    const search = (searchTerm || '').toLowerCase();
    const name = (property.name || '').toLowerCase();
    const city = (property.city || '').toLowerCase();
    const clientName = getClientName(property.client_id).toLowerCase();
    
    return name.includes(search) || 
           city.includes(search) || 
           clientName.includes(search);
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Propriedades</h1>
          <p className="text-[var(--text-muted)] mt-0.5 text-sm font-medium">Gestão das fazendas e locais de atendimento</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <Button 
            onClick={handleManualRefresh}
            variant="outline"
            disabled={isRefetching}
            className={`w-full md:w-auto border-[var(--border-color)] text-[var(--text-primary)] gap-2 h-12 px-6 rounded-2xl font-semibold ${isRefetching ? 'animate-pulse' : ''}`}
          >
            <RotateCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Button 
            onClick={() => setIsOpen(true)}
            className="w-full md:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-2 h-12 px-6 rounded-2xl font-semibold"
          >
            <Plus className="w-5 h-5" />
            Nova Propriedade
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardContent className="p-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar por nome, cidade ou proprietário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 text-base border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20 rounded-xl bg-gray-50 focus:bg-white transition-colors"
            />
          </div>
        </CardContent>
      </Card>

      {/* Properties List */}
      <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-[#1a4d2e]/20 border-t-[#1a4d2e] rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-4 font-medium">Carregando...</p>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-900 font-semibold text-lg">
                {searchTerm ? 'Nenhuma propriedade encontrada' : 'Nenhuma propriedade cadastrada'}
              </p>
              <p className="text-gray-500 mt-1">
                {searchTerm ? 'Tente uma busca diferente' : 'Comece adicionando sua primeira propriedade'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 border-b border-gray-100">
                    <TableHead className="font-semibold text-gray-600 py-4 px-6">Propriedade</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-gray-600">Proprietário</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-gray-600">Localização</TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold text-gray-600">Distância</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProperties.map((property) => (
                    <TableRow key={property.id || property._id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                            <MapPin className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{property.name}</p>
                            <p className="text-sm text-gray-500 md:hidden">
                              {getClientName(property.client_id)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-600">
                        {getClientName(property.client_id)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-600">
                        {property.city && property.state 
                          ? `${property.city} - ${property.state}` 
                          : property.city || property.state || '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {property.distance_km ? (
                          <div className="flex items-center gap-2 text-[#1a4d2e] font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg w-fit">
                            <Navigation className="w-4 h-4" />
                            {property.distance_km} km
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100">
                              <MoreVertical className="w-4 h-4 text-gray-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl shadow-lg border-0 p-1">
                            <DropdownMenuItem onClick={() => handleEdit(property)} className="rounded-lg cursor-pointer">
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteProperty.mutate(property.id || property._id)}
                              className="text-red-600 rounded-lg cursor-pointer focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold">
              {editingProperty ? 'Editar Propriedade' : 'Nova Propriedade'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Nome da Propriedade *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Fazenda Santa Maria"
                required
                className="h-11 rounded-xl border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Proprietário *</Label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full h-11 rounded-xl border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20 px-3 bg-white"
                required
              >
                <option value="" disabled>Selecione o proprietário</option>
                {(clients || []).filter(c => c && (c.id || c._id)).map((client) => (
                  <option key={client.id || client._id} value={client.id || client._id}>
                    {client.name || 'Cliente sem nome'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">CEP</Label>
              <div className="relative">
                <Input
                  placeholder="00000-000"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.replace(/\D/g, '').length === 8) {
                      handleCepSearch(val);
                    }
                  }}
                  className="h-11 rounded-xl border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20 pr-10"
                />
                {isSearchingCep && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#1a4d2e] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Endereço</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Endereço completo"
                className="h-11 rounded-xl border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Cidade</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                  className="h-11 rounded-xl border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Estado</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
                  className="h-11 rounded-xl border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Distância (km)</Label>
              <Input
                type="number"
                step="0.1"
                value={formData.distance_km}
                onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
                placeholder="Distância em quilômetros"
                className="h-11 rounded-xl border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20"
              />
              <p className="text-xs text-gray-500">
                Distância do seu consultório até a propriedade
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Coordenadas GPS</Label>
              <Input
                value={formData.coordinates}
                onChange={(e) => setFormData({ ...formData, coordinates: e.target.value })}
                placeholder="-23.5505, -46.6333"
                className="h-11 rounded-xl border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre a propriedade..."
                rows={3}
                className="rounded-xl border-gray-200 focus:border-[#1a4d2e] focus:ring-[#1a4d2e]/20 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl font-medium bg-white border border-black text-black hover:bg-gray-100" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 h-11 rounded-xl font-medium bg-white border border-[#22c55e] hover:bg-[#22c55e] text-black shadow-lg shadow-[#1a4d2e]/20">
                {editingProperty ? 'Salvar Alterações' : 'Cadastrar Propriedade'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
