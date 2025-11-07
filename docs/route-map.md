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
   │  └─ PricingTable
   └─ #/calc (Calculator)
      ├─ ScenarioForm
      │  └─ TokenMethodSection (radio buttons + optional text estimation)
      └─ CalcResults
```

The toolbar is now scoped to the Price Board route, while the calculator page keeps the updated token estimation section within its scenario form.
