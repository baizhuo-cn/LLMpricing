type KPIChipProps = {
  label: string;
  value: string | number;
  variant?: 'default' | 'accent' | 'warn';
};

export function KPIChip({ label, value, variant = 'default' }: KPIChipProps) {
  const variantStyles = {
    default: 'border-border bg-card',
    accent: 'border-accent/30 bg-accent/5',
    warn: 'border-[var(--color-brand-warn)]/30 bg-[var(--color-brand-warn)]/5',
  };

  return (
    <div className={`flex flex-col gap-1 rounded-2xl border ${variantStyles[variant]} px-6 py-4 transition-colors`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-xl">{value}</span>
    </div>
  );
}

type KPIGroupProps = {
  children: React.ReactNode;
};

export function KPIGroup({ children }: KPIGroupProps) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}
