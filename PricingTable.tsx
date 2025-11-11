import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "./ui/badge";

export type LLMModel = {
  id: string;
  name: string;
  provider: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: string;
  tags: string[];
};

type SortField = 'name' | 'provider' | 'inputPrice' | 'outputPrice';
type SortDirection = 'asc' | 'desc' | null;

type PricingTableProps = {
  models: LLMModel[];
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  unit: string;
};

export function PricingTable({ models, sortField, sortDirection, onSort, unit }: PricingTableProps) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-3 w-3 ml-1" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-3 w-3 ml-1" />;
    return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/30 transition-colors">
            <tr>
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => onSort('name')}
                  className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Model
                  <SortIcon field="name" />
                </button>
              </th>
              <th className="px-6 py-4 text-left w-[160px]">
                <button
                  onClick={() => onSort('provider')}
                  className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Provider
                  <SortIcon field="provider" />
                </button>
              </th>
              <th className="px-6 py-4 text-right w-[180px]">
                <button
                  onClick={() => onSort('inputPrice')}
                  className="flex items-center justify-end text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  Input (per {unit})
                  <SortIcon field="inputPrice" />
                </button>
              </th>
              <th className="px-6 py-4 text-right w-[180px]">
                <button
                  onClick={() => onSort('outputPrice')}
                  className="flex items-center justify-end text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  Output (per {unit})
                  <SortIcon field="outputPrice" />
                </button>
              </th>
              <th className="px-6 py-4 text-center w-[100px]">
                <span className="text-sm text-muted-foreground">Context</span>
              </th>
              <th className="px-6 py-4 text-left">
                <span className="text-sm text-muted-foreground">Tags</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr
                key={model.id}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-6 py-4">{model.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{model.provider}</td>
                <td className="px-6 py-4 text-right font-mono">${model.inputPrice.toFixed(2)}</td>
                <td className="px-6 py-4 text-right font-mono">${model.outputPrice.toFixed(2)}</td>
                <td className="px-6 py-4 text-center text-sm text-muted-foreground">{model.contextWindow}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {model.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
