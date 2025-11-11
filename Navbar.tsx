import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Sun, Moon } from "lucide-react";

type NavbarProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  unit: string;
  onUnitChange: (unit: string) => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
};

export function Navbar({ activeTab, onTabChange, currency, onCurrencyChange, unit, onUnitChange, theme, onThemeChange }: NavbarProps) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'compare', label: 'Compare' },
    { id: 'calculator', label: 'Calculator' },
    { id: 'ratings', label: 'Ratings' },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md transition-colors">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-[120px] py-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-mono text-sm">LLMpricing</span>
          <Badge variant="outline" className="ml-2 border-muted-foreground/30 text-xs">
            alpha
          </Badge>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-2 text-sm transition-colors rounded-lg ${
                  activeTab === tab.id
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            <Select value={currency} onValueChange={onCurrencyChange}>
              <SelectTrigger className="w-[100px] h-9 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CNY">CNY</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>

            <Select value={unit} onValueChange={onUnitChange}>
              <SelectTrigger className="w-[110px] h-9 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MTok">MTok</SelectItem>
                <SelectItem value="KTok">KTok</SelectItem>
                <SelectItem value="Chars">Chars</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </nav>
  );
}
