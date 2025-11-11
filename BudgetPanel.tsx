import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import type { LLMModel } from './PricingTable';

type BudgetPanelProps = {
  models: LLMModel[];
  currency: string;
};

export function BudgetPanel({ models, currency }: BudgetPanelProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [dailyCalls, setDailyCalls] = useState<string>('1000');
  const [avgInput, setAvgInput] = useState<string>('500');
  const [avgOutput, setAvgOutput] = useState<string>('300');
  const [result, setResult] = useState<{ daily: number; monthly: number } | null>(null);

  const handleEstimate = () => {
    const model = models.find((m) => m.id === selectedModel);
    if (!model) return;

    const calls = parseFloat(dailyCalls) || 0;
    const input = parseFloat(avgInput) || 0;
    const output = parseFloat(avgOutput) || 0;

    const inputCost = (input / 1000000) * model.inputPrice;
    const outputCost = (output / 1000000) * model.outputPrice;
    const costPerCall = inputCost + outputCost;
    
    const daily = costPerCall * calls;
    const monthly = daily * 30;

    setResult({ daily, monthly });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 transition-colors">
      <h3 className="text-lg mb-6">Monthly Budget Estimator</h3>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Model</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="border-border">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Daily API Calls</Label>
          <Input
            type="number"
            value={dailyCalls}
            onChange={(e) => setDailyCalls(e.target.value)}
            placeholder="1000"
            className="border-border"
          />
        </div>

        <div className="space-y-2">
          <Label>Avg Input Tokens per Call</Label>
          <Input
            type="number"
            value={avgInput}
            onChange={(e) => setAvgInput(e.target.value)}
            placeholder="500"
            className="border-border"
          />
        </div>

        <div className="space-y-2">
          <Label>Avg Output Tokens per Call</Label>
          <Input
            type="number"
            value={avgOutput}
            onChange={(e) => setAvgOutput(e.target.value)}
            placeholder="300"
            className="border-border"
          />
        </div>

        <Button
          onClick={handleEstimate}
          disabled={!selectedModel}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          Estimate
        </Button>

        {result !== null && (
          <div className="mt-6 space-y-3">
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
              <p className="text-sm text-muted-foreground mb-1">Daily Cost</p>
              <p className="text-xl">{currency} ${result.daily.toFixed(2)}</p>
            </div>
            <div className="p-4 rounded-lg bg-[#FFB86B]/10 border border-[#FFB86B]/30">
              <p className="text-sm text-muted-foreground mb-1">Monthly Estimate (30 days)</p>
              <p className="text-2xl">{currency} ${result.monthly.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Based on {dailyCalls} calls/day with avg {avgInput} input + {avgOutput} output tokens
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
