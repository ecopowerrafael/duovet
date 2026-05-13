import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RevenueChart({ data, period, onDataClick }) {
  const formatXAxis = (dateStr) => {
    const date = new Date(dateStr);
    if (period === 'today') return format(date, 'HH:mm');
    if (period === 'week') return format(date, 'EEE', { locale: ptBR });
    return format(date, 'dd/MM');
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload;
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-3 shadow-lg">
        <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">
          {format(new Date(data.date), "dd 'de' MMMM", { locale: ptBR })}
        </p>
        <p className="text-sm font-bold text-[#22c55e]">
          R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        {data.count > 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {data.count} atendimento{data.count > 1 ? 's' : ''}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-[#22c55e] to-[#16a34a] rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            Faturamento ao Longo do Tempo
          </CardTitle>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Evolução diária do faturamento no período
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] md:h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={data}
              onClick={onDataClick}
              className="cursor-pointer"
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatXAxis}
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `R$ ${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                strokeWidth={3}
                fill="url(#revenueGradient)"
                activeDot={{ r: 6, fill: "#22c55e", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}