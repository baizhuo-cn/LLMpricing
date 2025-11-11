import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Search, Download } from "lucide-react";

type FiltersBarProps = {
  provider: string;
  onProviderChange: (provider: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  onExport: () => void;
};

export function FiltersBar({ provider, onProviderChange, search, onSearchChange, onExport }: FiltersBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors">
      <Select value={provider} onValueChange={onProviderChange}>
        <SelectTrigger className="w-[180px] border-border">
          <SelectValue placeholder="All Providers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Providers</SelectItem>
          <SelectItem value="openai">OpenAI</SelectItem>
          <SelectItem value="anthropic">Anthropic</SelectItem>
          <SelectItem value="google">Google</SelectItem>
          <SelectItem value="deepseek">DeepSeek</SelectItem>
          <SelectItem value="qwen">Qwen</SelectItem>
        </SelectContent>
      </Select>

      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search models..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 border-border"
        />
      </div>

      <Button onClick={onExport} variant="outline" className="gap-2 border-border">
        <Download className="h-4 w-4" />
        Export
      </Button>
    </div>
  );
}
