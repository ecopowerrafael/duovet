import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';

export default function TopClientsChart({ data, onClientClick }) {
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload;
    
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-3 shadow-lg">
        <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">
          {data.name}
        </p>
        <p className="text-sm font-bold text-[#22c55e]">
          R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {data.count} atendimento{data.count > 1 ? 's' : ''}
        </p>
      </div>
    );
  };

  return (
    <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          Top Clientes por Faturamento
        </CardTitle>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Clientes com maior receita no período
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] md:h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              layout="vertical"
              onClick={onClientClick}
              className="cursor-pointer"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
              <XAxis 
                type="number" 
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `R$ ${value}`}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                width={window.innerWidth < 768 ? 80 : 120}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                fill="#22c55e"
                radius={[0, 8, 8, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}