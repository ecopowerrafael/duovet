import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
// Base44 removido: substituído por mocks/local logic
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  ArrowLeft,
  MapPin,
  Stethoscope,
  FileText,
  Camera,
  TrendingUp,
  DollarSign,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PropertyDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const propertyId = urlParams.get('id');

  // Mock property
  const { data: property, isLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      return {
        id: propertyId,
        name: 'Propriedade Demo',
        client_id: 1,
        address: 'Rua Demo, 123',
        area: 100,
        city: 'São Paulo',
        state: 'SP',
        distance_km: 12.5,
        coordinates: '-23.55,-46.63',
        notes: 'Propriedade de demonstração',
        animals: [1]
      };
    },
    enabled: !!propertyId
  });

  // Mock client
  const { data: client } = useQuery({
    queryKey: ['client', property?.client_id],
    queryFn: async () => {
      if (!property?.client_id) return null;
      return { id: 1, name: 'Cliente Demo' };
    },
    enabled: !!property?.client_id
  });

  // Mock appointments
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      return [
        { id: 1, date: '2024-06-01', type: 'clinico', property_id: propertyId }
      ];
    },
    enabled: !!propertyId
  });

  // Mock animals
  const { data: animals = [] } = useQuery({
    queryKey: ['animals', propertyId],
    queryFn: () => Promise.resolve([
      { id: 1, name: 'Animal Demo', species: 'bovino' }
    ]),
    enabled: !!propertyId
  });

  // Mock contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', propertyId],
    queryFn: () => Promise.resolve([
      { 
        id: 1, 
        property_id: propertyId, 
        contract_type: 'consultoria_tecnica', 
        billing_frequency: 'mensal', 
        amount: 1500.00, 
        status: 'ativo',
        description: 'Contrato de consultoria recorrente' 
      }
    ]),
    enabled: !!propertyId
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-muted)]">Propriedade não encontrada</p>
        <Link to={createPageUrl('Properties')}>
          <Button variant="link" className="mt-4">Voltar às propriedades</Button>
        </Link>
      </div>
    );
  }

  const safeFormatDate = (dateStr) => {
    try {
      if (!dateStr) return 'Data não informada';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Data inválida';
      return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch (e) {
      return 'Erro na data';
    }
  };

  const consultorias = (appointments || []).filter(a => a && a.type === 'consultoria');
  const clinicos = (appointments || []).filter(a => a && a.type !== 'consultoria');
  const allPhotos = (appointments || []).flatMap(a => (a && a.photos) || []);
  const totalRevenue = (appointments || []).reduce((sum, a) => sum + (a?.total_amount || 0), 0);
  const activeContracts = (contracts || []).filter(c => c && c.status === 'ativo');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => window.history.back()}
          className="rounded-xl"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
           <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">{property.name}</h1>
           <div className="flex flex-col gap-1 mt-2">
             <p className="text-[var(--text-muted)] flex items-center gap-2">
               <MapPin className="w-4 h-4" />
               {property.city && property.state ? `${property.city}, ${property.state}` : 'Localização não informada'}
             </p>
             {property.distance_km && (
               <p className="text-[var(--accent)] flex items-center gap-2 font-medium">
                 <span>📍 {property.distance_km} km de distância</span>
               </p>
             )}
           </div>
         </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-4">
            <Stethoscope className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{appointments.length}</p>
            <p className="text-sm opacity-90">Atendimentos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
          <CardContent className="p-4">
            <FileText className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{consultorias.length}</p>
            <p className="text-sm opacity-90">Consultorias</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
          <CardContent className="p-4">
            <DollarSign className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
            <p className="text-sm opacity-90">Receita Total</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-0">
          <CardContent className="p-4">
            <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{activeContracts.length}</p>
            <p className="text-sm opacity-90">Contratos Ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="timeline" className="space-y-6">
        <TabsList className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-1">
          <TabsTrigger value="timeline" className="rounded-lg">Linha do Tempo</TabsTrigger>
          <TabsTrigger value="consultorias" className="rounded-lg">Consultorias</TabsTrigger>
          <TabsTrigger value="animals" className="rounded-lg">Animais</TabsTrigger>
          <TabsTrigger value="contracts" className="rounded-lg">Contratos</TabsTrigger>
          <TabsTrigger value="photos" className="rounded-lg">Fotos</TabsTrigger>
        </TabsList>

        {/* Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[var(--accent)]" />
                Histórico Técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-center py-8 text-[var(--text-muted)]">Nenhum atendimento registrado</p>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div key={appointment.id} className="flex gap-4 p-4 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--bg-tertiary)]/80 transition-colors">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                          {appointment.type === 'consultoria' ? (
                            <FileText className="w-6 h-6 text-[var(--accent)]" />
                          ) : (
                            <Stethoscope className="w-6 h-6 text-[var(--accent)]" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-[var(--text-primary)]">
                              {appointment.type === 'consultoria' ? 'Consultoria' : 'Atendimento Clínico'}
                            </h4>
                            <p className="text-sm text-[var(--text-muted)]">
                              {safeFormatDate(appointment.date)}
                            </p>
                          </div>
                          <Link to={createPageUrl('AppointmentDetail') + `?id=${appointment.id}`}>
                            <Button size="sm" variant="outline" className="rounded-lg">
                              Ver Detalhes
                            </Button>
                          </Link>
                        </div>
                        {appointment.consultoria_data?.description && (
                          <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                            {appointment.consultoria_data.description}
                          </p>
                        )}
                        {appointment.diagnosis && (
                          <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                            {appointment.diagnosis}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consultorias */}
        <TabsContent value="consultorias" className="space-y-4">
          {consultorias.length === 0 ? (
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-[var(--text-muted)]">Nenhuma consultoria registrada</p>
              </CardContent>
            </Card>
          ) : (
            consultorias.map((consultoria) => (
              <Card key={consultoria.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {consultoria.consultoria_data?.service_type?.replace('_', ' ').toUpperCase() || 'SERVIÇO NÃO INFORMADO'}
                      </CardTitle>
                      <p className="text-sm text-[var(--text-muted)] mt-1">
                        {safeFormatDate(consultoria.date)}
                      </p>
                    </div>
                    <Link to={createPageUrl('AppointmentDetail') + `?id=${consultoria.id}`}>
                      <Button size="sm" className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg">
                        Ver Relatório
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {consultoria.consultoria_data?.description && (
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Descrição</p>
                      <p className="text-sm text-[var(--text-secondary)]">{consultoria.consultoria_data.description}</p>
                    </div>
                  )}
                  {consultoria.consultoria_data?.technical_notes && (
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Observações Técnicas</p>
                      <p className="text-sm text-[var(--text-secondary)]">{consultoria.consultoria_data.technical_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Animals */}
        <TabsContent value="animals">
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader>
              <CardTitle>Animais da Propriedade ({animals.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {animals.length === 0 ? (
                <p className="text-center py-8 text-[var(--text-muted)]">Nenhum animal cadastrado</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {(animals || []).filter(Boolean).map((animal) => (
                    <Link key={animal.id} to={createPageUrl('AnimalDetail') + `?id=${animal.id}`}>
                      <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl hover:bg-[var(--bg-tertiary)]/80 transition-colors">
                        <h4 className="font-semibold text-[var(--text-primary)]">{animal.name || 'Sem nome'}</h4>
                        <p className="text-sm text-[var(--text-muted)]">{animal.species || 'Espécie não informada'} • {animal.breed || 'Sem raça definida'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts */}
        <TabsContent value="contracts">
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader>
              <CardTitle>Contratos Recorrentes</CardTitle>
            </CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <p className="text-center py-8 text-[var(--text-muted)]">Nenhum contrato ativo</p>
              ) : (
                <div className="space-y-3">
                  {(contracts || []).filter(Boolean).map((contract) => (
                    <div key={contract.id} className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-[var(--text-primary)]">
                            {contract.contract_type?.replace('_', ' ').toUpperCase() || 'CONTRATO'}
                          </h4>
                          <p className="text-sm text-[var(--text-muted)]">
                            Cobrança {contract.billing_frequency || 'não informada'} • R$ {(contract.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <Badge className={
                          contract.status === 'ativo' ? 'bg-green-100 text-green-700' :
                          contract.status === 'suspenso' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }>
                          {contract.status || 'Pendente'}
                        </Badge>
                      </div>
                      {contract.description && (
                        <p className="text-sm text-[var(--text-secondary)]">{contract.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Photos */}
        <TabsContent value="photos">
          <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[var(--accent)]" />
                Registro Fotográfico ({allPhotos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allPhotos.length === 0 ? (
                <p className="text-center py-8 text-[var(--text-muted)]">Nenhuma foto registrada</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {allPhotos.map((photo, index) => (
                    <div key={index} className="aspect-square rounded-xl overflow-hidden">
                      <img
                        src={photo.url}
                        alt={photo.caption || `Foto ${index + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
