import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import AnimalIcon from '../animals/AnimalIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Eye,
  MapPin,
  Calendar,
  Clock,
  MoreVertical,
  Play,
  MessageCircle,
  Download,
  Navigation,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

const TYPE_CONFIG = {
  clinico: { label: 'Clínico', color: 'bg-blue-100 text-blue-700', darkColor: 'dark:bg-blue-900/30 dark:text-blue-400' },
  reprodutivo: { label: 'Reprodutivo', color: 'bg-purple-100 text-purple-700', darkColor: 'dark:bg-purple-900/30 dark:text-purple-400' },
  cirurgico: { label: 'Cirúrgico', color: 'bg-red-100 text-red-700', darkColor: 'dark:bg-red-900/30 dark:text-red-400' },
  sanitario: { label: 'Sanitário', color: 'bg-emerald-100 text-emerald-700', darkColor: 'dark:bg-emerald-900/30 dark:text-emerald-400' },
  preventivo: { label: 'Preventivo', color: 'bg-indigo-100 text-indigo-700', darkColor: 'dark:bg-indigo-900/30 dark:text-indigo-400' },
  consultoria: { label: 'Consultoria', color: 'bg-cyan-100 text-cyan-700', darkColor: 'dark:bg-cyan-900/30 dark:text-cyan-400' }
};

const STATUS_CONFIG = {
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700', darkColor: 'dark:bg-amber-900/30 dark:text-amber-400', icon: AlertCircle },
  finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-700', darkColor: 'dark:bg-green-900/30 dark:text-green-400' },
  faturado: { label: 'Faturado', color: 'bg-purple-100 text-purple-700', darkColor: 'dark:bg-purple-900/30 dark:text-purple-400' }
};

export default function AppointmentCard({
  appointment,
  clientName,
  propertyName,
  animalNames = [],
  lotName,
  species,
  index = 0,
  onViewDetails,
  onGenerateReport,
  onSendWhatsApp,
  onDelete
}) {
  const typeConfig = TYPE_CONFIG[appointment.type] || TYPE_CONFIG.clinico;
  const statusConfig = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.em_andamento;
  const StatusIcon = statusConfig.icon;
  const appointmentId = appointment?.id || appointment?._id || '';

  const appointmentDate = new Date(appointment.date);
  const isUpcoming = appointmentDate > new Date();
  const isOverdue = isUpcoming === false && appointment.status === 'em_andamento';
  const visibleAnimalNames = (animalNames || []).slice(0, 2);
  const extraAnimalsCount = Math.max((animalNames || []).length - visibleAnimalNames.length, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl hover:border-[var(--accent)]/30 hover:shadow-sm transition-all group cursor-pointer overflow-hidden">
        <CardContent className="p-3.5 md:p-2.5 space-y-3 md:space-y-2.5 min-w-0">
          {/* Header: Type Badge + Status - iOS Style */}
          <div className="flex items-start justify-between min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <Badge className={`${typeConfig.color} ${typeConfig.darkColor} font-semibold text-[10px] px-2 py-0.5 rounded-md max-w-full truncate`}>
                {typeConfig.label}
              </Badge>
              <Badge className={`${statusConfig.color} ${statusConfig.darkColor} font-semibold text-[10px] px-2 py-0.5 rounded-md max-w-full truncate`}>
                {statusConfig.label}
              </Badge>
              {appointment.isPending && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold text-[10px] px-2 py-0.5 rounded-md animate-pulse border border-amber-300 max-w-full truncate">
                  <Clock className="w-3 h-3 mr-1" />
                  Pendente
                </Badge>
              )}
              {isOverdue && (
                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 max-w-full truncate">
                  <AlertCircle className="w-3 h-3" />
                  Atrasado
                </Badge>
              )}
              {appointment.needs_return && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold text-[10px] px-2 py-0.5 rounded-md max-w-full truncate">
                  Retorno
                </Badge>
              )}
            </div>
          </div>

          {/* Main Content Grid - iOS Style */}
          <div className="grid grid-cols-1 gap-2.5 min-w-0">
            {/* Column 1: Client & Property */}
            <div className="space-y-2 min-w-0">
              {/* Client Name - Prominent */}
              <div>
                <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1.5">Cliente</p>
                <p className="text-base md:text-sm font-bold text-[var(--text-primary)] line-clamp-2 md:line-clamp-1 tracking-tight break-words">
                  {clientName || '-'}
                </p>
              </div>

              {/* Property - with icon */}
              {propertyName && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Propriedade</p>
                    <p className="text-sm md:text-xs text-[var(--text-primary)] font-semibold line-clamp-2 md:line-clamp-1 break-words">
                      {propertyName}
                    </p>
                  </div>
                </div>
              )}

              {/* Lot - if available */}
               {lotName && (
                 <div className="flex items-start gap-2.5">
                   <div className="w-8 h-8 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                     <AnimalIcon 
                       species={species || 'bovino'} 
                       isLot={true} 
                       white={false}
                       className="w-5 h-5 text-[var(--accent)]" 
                     />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1.5">Lote</p>
                     <Badge
                       variant="outline"
                       className="max-w-full text-xs font-bold bg-[var(--bg-tertiary)] text-[var(--accent)] border-[var(--accent)]/20 px-2 py-0.5 rounded-lg truncate"
                     >
                       {lotName}
                     </Badge>
                   </div>
                 </div>
               )}
 
               {/* Animals - if available and no lot */}
               {!lotName && animalNames?.length > 0 && (
                 <div className="flex items-start gap-2.5">
                   <div className="w-8 h-8 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                     <AnimalIcon 
                       species={species || 'bovino'} 
                       white={false}
                       className="w-5 h-5 text-[var(--accent)]" 
                     />
                   </div>
                   <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1.5">
                      Animal{animalNames.length > 1 ? 's' : ''}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {visibleAnimalNames.map((name, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="max-w-full text-[10px] font-semibold bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-color)] px-2 py-0.5 rounded-md truncate"
                        >
                          {name}
                        </Badge>
                      ))}
                      {extraAnimalsCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)] px-2 py-0.5 rounded-md"
                        >
                          +{extraAnimalsCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Date & Time Info + Value - iOS Style */}
            <div className="bg-[var(--bg-tertiary)] rounded-xl p-2.5 space-y-2">
              {/* Date */}
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">Data</p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {format(appointmentDate, "d 'de' MMM", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">Horário</p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {format(appointmentDate, 'HH:mm', { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Distance if available */}
              {appointment.displacement_cost > 0 && (
                <div className="flex items-start gap-2.5 pt-2 border-t border-[var(--border-color)]">
                  <Navigation className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-0.5">Deslocar</p>
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      R$ {appointment.displacement_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}

              {/* Total Amount */}
              <div className="pt-2 border-t border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">Total</p>
                <p className="text-sm font-bold text-[var(--accent)] tracking-tight">
                  R$ {(appointment.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons - iOS Style */}
          <div className="flex items-center gap-2 md:gap-1.5 pt-2 border-t border-[var(--border-color)] min-w-0">
            {/* Primary Action */}
            {appointment.status === 'em_andamento' ? (
              appointment.isPending ? (
                <Button disabled className="flex-1 w-full bg-amber-500/80 text-white gap-1.5 rounded-xl font-semibold h-10 md:h-9 text-sm md:text-xs shadow-lg shadow-amber-500/25 cursor-not-allowed px-3 md:px-2">
                  <Clock className="w-4 h-4" />
                  <span className="truncate">Sincronizando</span>
                </Button>
              ) : (
                <Link to={createPageUrl('AppointmentDetail') + `?id=${appointmentId}`} className="flex-1 min-w-0">
                  <Button className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-1.5 rounded-xl font-semibold h-10 md:h-9 text-sm md:text-xs shadow-lg shadow-[var(--accent)]/25 px-3 md:px-2">
                    <Play className="w-3.5 h-3.5" />
                    <span className="truncate">Continuar</span>
                  </Button>
                </Link>
              )
            ) : (
              <Link to={createPageUrl('AppointmentDetail') + `?id=${appointmentId}`} className="flex-1 min-w-0">
                <Button className="w-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] gap-1.5 rounded-xl font-semibold h-10 md:h-9 text-sm md:text-xs border border-[var(--border-color)] px-3 md:px-2">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="truncate">Detalhes</span>
                </Button>
              </Link>
            )}

            {appointment.status === 'em_andamento' && !appointment.isPending && (
              <>
                <div className="hidden md:flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-9 w-9 p-0 text-red-600 border-red-200 hover:text-red-700 hover:border-red-300"
                    onClick={() => onDelete?.(appointmentId)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="md:hidden ml-auto flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-10 w-10 p-0 border-[var(--border-color)]"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[var(--bg-card)] border-[var(--border-color)]">
                      <DropdownMenuItem
                        onClick={() => onDelete?.(appointmentId)}
                        className="gap-2 text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir atendimento
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}

            {/* Secondary Actions - Hidden on Mobile, Show in Menu */}
            {appointment.status !== 'em_andamento' && (
              <>
                <div className="hidden md:flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-9 w-9 p-0 text-[var(--text-primary)] border-[var(--border-color)] font-medium"
                    onClick={() => onGenerateReport?.(appointmentId)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-9 w-9 p-0 text-[var(--text-primary)] border-[var(--border-color)] font-medium"
                    onClick={() => onSendWhatsApp?.(appointmentId)}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Mobile Menu */}
                <div className="md:hidden ml-auto flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-10 w-10 p-0 border-[var(--border-color)]"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[var(--bg-card)] border-[var(--border-color)]">
                      <DropdownMenuItem
                        onClick={() => onGenerateReport?.(appointmentId)}
                        className="gap-2 text-[var(--text-primary)] focus:bg-[var(--bg-tertiary)]"
                      >
                        <Download className="w-4 h-4" />
                        Gerar Relatório
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onSendWhatsApp?.(appointmentId)}
                        className="gap-2 text-[var(--text-primary)] focus:bg-[var(--bg-tertiary)]"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Enviar WhatsApp
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
