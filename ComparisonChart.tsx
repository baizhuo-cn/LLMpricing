import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { LLMModel } from './PricingTable';

type ComparisonChartProps = {
  models: LLMModel[];
  selectedModels: string[];
  type: 'input' | 'output';
};

export function ComparisonChart({ models, selectedModels, type }: ComparisonChartProps) {
  const filteredModels = models.filter((m) => selectedModels.includes(m.id));
  
  const data = filteredModels.map((model) => ({
    name: model.name,
    price: type === 'input' ? model.inputPrice : model.outputPrice,
  }));

  const title = type === 'input' ? 'Input Price Comparison' : 'Output Price Comparison';

  return (
    <div className="rounded-2xl border border-border bg-card p-6 transition-colors">
      <div className="mb-6">
        <h3 className="text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">USD per MTok</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-line)" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--color-base-muted)"
            tick={{ fill: 'var(--color-base-muted)', fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="var(--color-base-muted)"
            tick={{ fill: 'var(--color-base-muted)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-base-card)',
              border: '1px solid var(--color-base-line)',
              borderRadius: '8px',
              color: 'var(--color-base-fg)',
            }}
            labelStyle={{ color: 'var(--color-base-fg)' }}
          />
          <Bar
            dataKey="price"
            fill={type === 'input' ? 'var(--color-brand-primary)' : 'var(--color-brand-accent)'}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
