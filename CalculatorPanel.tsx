import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import type { LLMModel } from './PricingTable';

type CalculatorPanelProps = {
  models: LLMModel[];
  currency: string;
};

export function CalculatorPanel({ models, currency }: CalculatorPanelProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [inputTokens, setInputTokens] = useState<string>('1000');
  const [outputTokens, setOutputTokens] = useState<string>('500');
  const [result, setResult] = useState<number | null>(null);

  const handleCalculate = () => {
    const model = models.find((m) => m.id === selectedModel);
    if (!model) return;

    const input = parseFloat(inputTokens) || 0;
    const output = parseFloat(outputTokens) || 0;

    const inputCost = (input / 1000000) * model.inputPrice;
    const outputCost = (output / 1000000) * model.outputPrice;
    const total = inputCost + outputCost;

    setResult(total);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 transition-colors">
      <h3 className="text-lg mb-6">Single Request Calculator</h3>
      
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
          <Label>Input Tokens</Label>
          <Input
            type="number"
            value={inputTokens}
            onChange={(e) => setInputTokens(e.target.value)}
            placeholder="1000"
            className="border-border"
          />
        </div>

        <div className="space-y-2">
          <Label>Output Tokens</Label>
          <Input
            type="number"
            value={outputTokens}
            onChange={(e) => setOutputTokens(e.target.value)}
            placeholder="500"
            className="border-border"
          />
        </div>

        <Button
          onClick={handleCalculate}
          disabled={!selectedModel}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Calculate
        </Button>

        {result !== null && (
          <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/30">
            <p className="text-sm text-muted-foreground mb-1">Estimated Cost</p>
            <p className="text-2xl">{currency} ${result.toFixed(6)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Based on {inputTokens} input + {outputTokens} output tokens
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
