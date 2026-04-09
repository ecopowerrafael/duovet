import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Truck } from 'lucide-react';

export default function ServiceVsDisplacementChart({ data, onBarClick }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-3 shadow-lg">
        <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">
          {label}
        </p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-1">
            <span className="text-xs text-[var(--text-muted)]">{entry.name}:</span>
            <span className="text-sm font-bold" style={{ color: entry.color }}>
              R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        <div className="border-t border-[var(--border-color)] mt-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Total:</span>
            <span className="text-sm font-bold text-[var(--text-primary)]">
              R$ {(payload[0].value + payload[1].value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <div className="w-9 h-9 bg-purple-500/10 rounded-xl flex items-center justify-center">
            <Truck className="w-5 h-5 text-purple-600" />
          </div>
          Serviço x Deslocamento
        </CardTitle>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Comparação entre valores de serviço e deslocamento
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] md:h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data}
              onClick={onBarClick}
              className="cursor-pointer"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
              <XAxis 
                dataKey="name"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `R$ ${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => {
                  const labels = { service: 'Serviço', displacement: 'Deslocamento' };
                  return <span className="text-[var(--text-secondary)]">{labels[value] || value}</span>;
                }}
              />
              <Bar 
                dataKey="service" 
                stackId="a" 
                fill="#22c55e" 
                radius={[0, 0, 8, 8]}
              />
              <Bar 
                dataKey="displacement" 
                stackId="a" 
                fill="#8b5cf6" 
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}