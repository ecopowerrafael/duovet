import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '../../../utils';
import { base44 } from '../../../api/base44Client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../../../components/ui/select';
import {
	Plus,
	Search,
	Stethoscope,
	Filter
} from 'lucide-react';
import AppointmentCard from '../../../components/appointments/AppointmentCard';

const TYPES = [
	{ value: 'clinico', label: 'Clínico', color: 'bg-blue-100 text-blue-700' },
	{ value: 'reprodutivo', label: 'Reprodutivo', color: 'bg-pink-100 text-pink-700' },
	{ value: 'cirurgico', label: 'Cirúrgico', color: 'bg-red-100 text-red-700' },
	{ value: 'sanitario', label: 'Sanitário', color: 'bg-green-100 text-green-700' },
	{ value: 'preventivo', label: 'Preventivo', color: 'bg-purple-100 text-purple-700' },
	{ value: 'consultoria', label: 'Consultoria', color: 'bg-cyan-100 text-cyan-700' }
];

const STATUS = [
	{ value: 'em_andamento', label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
	{ value: 'finalizado', label: 'Finalizado', color: 'bg-green-100 text-green-700' },
	{ value: 'faturado', label: 'Faturado', color: 'bg-purple-100 text-purple-700' }
];

export default function Appointments() {
	const [searchTerm, setSearchTerm] = useState('');
	const [filterType, setFilterType] = useState('all');
	const [filterStatus, setFilterStatus] = useState('all');

	const { data: user } = useQuery({
		queryKey: ['user'],
		queryFn: () => base44.auth.me()
	});

	const { data: appointments = [], isLoading } = useQuery({
		queryKey: ['appointments', user?.email],
		queryFn: () => base44.entities.Appointment.filter({ created_by: user?.email }, '-date'),
		enabled: !!user?.email
	});

	const { data: clients = [] } = useQuery({
		queryKey: ['clients', user?.email],
		queryFn: () => base44.entities.Client.filter({ created_by: user?.email }),
		enabled: !!user?.email
	});

	const { data: properties = [] } = useQuery({
		queryKey: ['properties', user?.email],
		queryFn: () => base44.entities.Property.filter({ created_by: user?.email }),
		enabled: !!user?.email
	});

	const { data: animals = [] } = useQuery({
		queryKey: ['animals', user?.email],
		queryFn: () => base44.entities.Animal.filter({ created_by: user?.email }),
		enabled: !!user?.email
	});

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('new') === 'true') {
			window.location.href = createPageUrl('NewAppointment');
		}
	}, []);

	const getClientName = (clientId) => {
		const client = clients.find(c => c.id === clientId);
		return client?.name || '-';
	};

	const getPropertyName = (propertyId) => {
		const property = properties.find(p => p.id === propertyId);
		return property?.name || '-';
	};

	const getAnimalNames = (animalIds) => {
		if (!animalIds || animalIds.length === 0) return [];
		return animalIds
			.map(id => animals.find(a => a.id === id)?.name)
			.filter(Boolean);
	};

	const handleGenerateReport = async (appointmentId) => {
		const app = filteredAppointments.find(a => a.id === appointmentId);
		if (!app) return;
		window.location.href = createPageUrl('AppointmentDetail') + `?id=${appointmentId}&action=generatePDF`;
	};

	const handleSendWhatsApp = async (appointmentId) => {
		const app = filteredAppointments.find(a => a.id === appointmentId);
		const client = clients.find(c => c.id === app?.client_id);
		if (!client?.phone) {
			alert('Cliente não possui número de WhatsApp cadastrado');
			return;
		}
		window.location.href = createPageUrl('AppointmentDetail') + `?id=${appointmentId}&action=sendWhatsApp`;
	};

	const filteredAppointments = appointments
		.filter(appointment => {
			const matchesSearch = 
				getClientName(appointment.client_id)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				getPropertyName(appointment.property_id)?.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesType = filterType === 'all' || appointment.type === filterType;
			const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus;
			return matchesSearch && matchesType && matchesStatus;
		})
		.sort((a, b) => {
			const dateA = a?.date ? new Date(a.date).getTime() : 0;
			const dateB = b?.date ? new Date(b.date).getTime() : 0;
			if (dateB !== dateA) return dateB - dateA;
			const idA = Number(a?.id || 0);
			const idB = Number(b?.id || 0);
			return idB - idA;
		});

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Atendimentos</h1>
					<p className="text-[var(--text-muted)] mt-1">Gestão clínica veterinária</p>
				</div>
				<Link to={createPageUrl('NewAppointment')} className="w-full md:w-auto">
					<Button className="w-full md:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white gap-2 h-12 px-6 rounded-xl font-medium">
						<Plus className="w-5 h-5" />
						Novo Atendimento
					</Button>
				</Link>
			</div>
			{/* Filters */}
			<div className="flex flex-col lg:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
					<Input
						placeholder="Buscar por cliente ou propriedade..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-12 h-12 rounded-xl bg-[var(--bg-card)] border-[var(--border-color)]"
					/>
				</div>
				<div className="relative w-full lg:w-auto">
					<Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
					<select
						value={filterType}
						onChange={(e) => setFilterType(e.target.value)}
						className="w-full lg:w-40 h-12 pl-10 pr-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] appearance-none"
					>
						<option value="all">Todos os tipos</option>
						{TYPES.map((type) => (
							<option key={type.value} value={type.value}>
								{type.label}
							</option>
						))}
					</select>
				</div>
				<div className="relative w-full lg:w-auto">
					<select
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value)}
						className="w-full lg:w-40 h-12 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] appearance-none"
					>
						<option value="all">Todos status</option>
						{STATUS.map((status) => (
							<option key={status.value} value={status.value}>
								{status.label}
							</option>
						))}
					</select>
				</div>
			</div>
			{/* Appointments List */}
			{isLoading ? (
				<div className="flex items-center justify-center h-64">
					<div className="w-10 h-10 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin"></div>
				</div>
			) : filteredAppointments.length === 0 ? (
				<div className="text-center py-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)]">
					<div className="w-20 h-20 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
						<Stethoscope className="w-10 h-10 text-[var(--text-muted)]" />
					</div>
					<p className="text-[var(--text-primary)] font-semibold text-lg">
						{searchTerm ? 'Nenhum atendimento encontrado' : 'Nenhum atendimento registrado'}
					</p>
					<p className="text-[var(--text-muted)] mt-1">
						{searchTerm ? 'Tente ajustar os filtros' : 'Comece criando seu primeiro atendimento'}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-8 gap-3">
					{filteredAppointments.map((appointment, index) => (
						<div key={appointment.id} className="lg:col-span-2 min-w-0">
							<AppointmentCard
								appointment={appointment}
								clientName={getClientName(appointment.client_id)}
								propertyName={getPropertyName(appointment.property_id)}
								animalNames={getAnimalNames(appointment.animal_ids)}
								index={index}
								onGenerateReport={handleGenerateReport}
								onSendWhatsApp={handleSendWhatsApp}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
