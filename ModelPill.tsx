type ModelPillProps = {
  name: string;
  selected: boolean;
  onToggle: () => void;
};

export function ModelPill({ name, selected, onToggle }: ModelPillProps) {
  return (
    <button
      onClick={onToggle}
      className={`px-4 py-2 rounded-full border transition-all ${
        selected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground'
      }`}
    >
      {name}
    </button>
  );
}
