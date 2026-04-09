import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { DollarSign } from 'lucide-react';

const STATUS_CONFIG = {
  pago: { label: 'Pago', color: '#22c55e' },
  pendente: { label: 'Pendente', color: '#f59e0b' },
  parcial: { label: 'Parcial', color: '#3b82f6' }
};

export default function PaymentStatusChart({ data, onStatusClick }) {
  const chartData = data.map(item => ({
    ...item,
    name: STATUS_CONFIG[item.status]?.label || item.status,
    color: STATUS_CONFIG[item.status]?.color || '#6b7280'
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0];
    const percentage = ((data.value / total) * 100).toFixed(1);
    
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-3 shadow-lg">
        <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">
          {data.name}
        </p>
        <p className="text-sm font-bold" style={{ color: data.payload.color }}>
          R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {percentage}% do total • {data.payload.count} atendimento{data.payload.count > 1 ? 's' : ''}
        </p>
      </div>
    );
  };

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
          Status Financeiro
        </CardTitle>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Distribuição de pagamentos por status
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] md:h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius={window.innerWidth < 768 ? 80 : 110}
                innerRadius={window.innerWidth < 768 ? 50 : 70}
                fill="#8884d8"
                dataKey="value"
                onClick={(data) => onStatusClick(data.status)}
                className="cursor-pointer outline-none focus:outline-none"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry) => (
                  <span className="text-xs text-[var(--text-secondary)]">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}