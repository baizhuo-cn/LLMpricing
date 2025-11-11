import { Star } from "lucide-react";

export type Rating = {
  id: string;
  name: string;
  provider: string;
  quote: string;
  score: number;
  maxScore: number;
  votes: number;
};

type RatingItemProps = {
  rating: Rating;
  selected?: boolean;
  onSelect?: () => void;
};

export function RatingItem({ rating, selected = false, onSelect }: RatingItemProps) {
  const stars = Math.round((rating.score / rating.maxScore) * 5);

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border transition-all text-left ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-muted-foreground/50'
      }`}
    >
      <div className="p-6 flex items-start justify-between gap-6">
        <div className="flex gap-4 flex-1">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-muted shrink-0">
            <span className="text-xs font-mono">{rating.provider.substring(0, 2).toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <h4 className="mb-1">{rating.name}</h4>
            <p className="text-sm" style={{ color: 'var(--color-brand-warn)' }}>"{rating.quote}"</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < stars ? 'text-muted-foreground' : 'fill-none text-muted-foreground'
                }`}
                style={i < stars ? { fill: 'var(--color-brand-warn)', color: 'var(--color-brand-warn)' } : undefined}
              />
            ))}
          </div>
          <div className="text-right">
            <p className="text-sm">
              {rating.score}/{rating.maxScore}
            </p>
            <p className="text-xs text-muted-foreground">{rating.votes.toLocaleString()} votes</p>
          </div>
        </div>
      </div>
    </button>
  );
}
