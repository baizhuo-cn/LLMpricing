# Route & Layout Overview

```
AppLayout
├─ TopBar
│  ├─ Branding
│  ├─ MainNav (#/, #/calc)
│  └─ Toolbar (visible when route === '#/')
└─ Main
   ├─ #/ (Price Board)
   │  ├─ Guide banner
   │  ├─ ComparePanel (2–4 selected models, hidden otherwise)
   │  └─ PricingTable
   └─ #/calc (Calculator)
      ├─ ScenarioForm
      │  └─ TokenMethodSection (manual inputs or text estimation)
      ├─ CalcResults
      └─ CalcHistory (20-entry local timeline with export/clear controls)
```

The toolbar is now scoped to the Price Board route. The calculator keeps the refreshed token estimation module and surfaces the
recent calculation history beneath the results table.
