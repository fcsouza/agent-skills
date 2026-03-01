# UI Patterns for Idle Games

React + Tailwind CSS + shadcn/ui patterns for idle/incremental game interfaces.

---

## Number Display

Auto-formatting component that handles K/M/B/T and scientific notation.

```tsx
import { type Decimal } from 'break_infinity.js';

type NumberDisplayProps = {
  value: number | Decimal;
  decimals?: number;
  showPerSecond?: boolean;
};

function formatNumber(value: number, decimals = 2): string {
  if (value < 1_000) return value.toFixed(decimals);
  if (value < 1e6) return (value / 1e3).toFixed(decimals) + 'K';
  if (value < 1e9) return (value / 1e6).toFixed(decimals) + 'M';
  if (value < 1e12) return (value / 1e9).toFixed(decimals) + 'B';
  if (value < 1e15) return (value / 1e12).toFixed(decimals) + 'T';
  return value.toExponential(decimals);
}

function NumberDisplay({ value, decimals = 2, showPerSecond }: NumberDisplayProps) {
  const num = typeof value === 'number' ? value : value.toNumber();
  return (
    <span className="font-mono tabular-nums">
      {formatNumber(num, decimals)}
      {showPerSecond && <span className="text-muted-foreground text-xs">/s</span>}
    </span>
  );
}
```

---

## Progress Bars

### Linear Progress

```tsx
type ProgressBarProps = {
  current: number;
  max: number;
  label?: string;
  color?: string;
};

function ProgressBar({ current, max, label, color = 'bg-primary' }: ProgressBarProps) {
  const percent = Math.min(100, (current / max) * 100);
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span className="text-muted-foreground">{percent.toFixed(1)}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
```

### Logarithmic Scale

For progress bars spanning huge ranges (e.g., 0 to 1e15):

```tsx
function LogProgressBar({ current, max, ...props }: ProgressBarProps) {
  const logPercent = max > 0
    ? (Math.log10(Math.max(1, current)) / Math.log10(Math.max(10, max))) * 100
    : 0;
  return <ProgressBar current={logPercent} max={100} {...props} />;
}
```

### Milestone Markers

```tsx
function MilestoneProgress({ current, milestones }: {
  current: number;
  milestones: { at: number; label: string }[];
}) {
  const max = milestones[milestones.length - 1]?.at ?? 100;
  return (
    <div className="relative">
      <ProgressBar current={current} max={max} />
      <div className="relative mt-1 h-2">
        {milestones.map((m) => (
          <div
            key={m.at}
            className="absolute -top-3 h-3 w-0.5 bg-foreground"
            style={{ left: `${(m.at / max) * 100}%` }}
            title={m.label}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Upgrade Cards

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Upgrade = {
  id: string;
  name: string;
  description: string;
  cost: number;
  owned: number;
  effect: string;
};

type BuyAmount = 1 | 10 | 25 | 'max';

function UpgradeCard({
  upgrade,
  currency,
  buyAmount,
  onBuy,
}: {
  upgrade: Upgrade;
  currency: number;
  buyAmount: BuyAmount;
  onBuy: (id: string, amount: BuyAmount) => void;
}) {
  const canAfford = currency >= upgrade.cost;
  return (
    <Card className={canAfford ? 'border-primary' : 'opacity-60'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{upgrade.name}</CardTitle>
          <span className="text-muted-foreground text-sm">x{upgrade.owned}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-muted-foreground text-sm">{upgrade.description}</p>
        <p className="text-sm font-medium">{upgrade.effect}</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm">
            Cost: <NumberDisplay value={upgrade.cost} />
          </span>
          <Button
            size="sm"
            disabled={!canAfford}
            onClick={() => onBuy(upgrade.id, buyAmount)}
          >
            Buy {buyAmount === 'max' ? 'Max' : buyAmount}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Buy Amount Selector

```tsx
function BuyAmountSelector({
  value,
  onChange,
}: {
  value: BuyAmount;
  onChange: (amount: BuyAmount) => void;
}) {
  const options: BuyAmount[] = [1, 10, 25, 'max'];
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <Button
          key={opt}
          size="sm"
          variant={value === opt ? 'default' : 'outline'}
          onClick={() => onChange(opt)}
        >
          {opt === 'max' ? 'Max' : `x${opt}`}
        </Button>
      ))}
    </div>
  );
}
```

---

## Resource Display

Top bar showing all resources with amounts and rates.

```tsx
type Resource = {
  id: string;
  name: string;
  icon: string;
  amount: number;
  perSecond: number;
  capacity?: number;
};

function ResourceBar({ resources }: { resources: Resource[] }) {
  return (
    <div className="sticky top-0 z-10 border-b bg-background p-2">
      <div className="flex flex-wrap gap-4">
        {resources.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <span>{r.icon}</span>
            <div className="flex flex-col">
              <span className="font-mono text-sm font-bold">
                <NumberDisplay value={r.amount} />
                {r.capacity && (
                  <span className="text-muted-foreground">
                    /{formatNumber(r.capacity)}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                <NumberDisplay value={r.perSecond} showPerSecond />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Prestige Confirmation

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function PrestigeDialog({
  open,
  onConfirm,
  onCancel,
  currencyEarned,
  multiplierPreview,
  resetsDescription,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  currencyEarned: number;
  multiplierPreview: number;
  resetsDescription: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prestige?</DialogTitle>
          <DialogDescription>Reset progress for permanent bonuses.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">You will gain:</p>
            <p className="font-mono text-lg font-bold text-primary">
              <NumberDisplay value={currencyEarned} /> Prestige Points
            </p>
            <p className="text-muted-foreground text-sm">
              New multiplier: {multiplierPreview.toFixed(2)}x
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">This will reset:</p>
            <ul className="text-muted-foreground ml-4 list-disc text-sm">
              {resetsDescription.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Prestige</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Tab Navigation

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type GameTab = {
  id: string;
  label: string;
  hasNew?: boolean;
  unlocked: boolean;
};

function GameTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
}: {
  tabs: GameTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}) {
  const visibleTabs = tabs.filter((t) => t.unlocked);
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="w-full justify-start">
        {visibleTabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="relative">
            {tab.label}
            {tab.hasNew && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                New
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
```

---

## Idle Gain Notification

Toast shown when player returns after being away.

```tsx
import { useToast } from '@/hooks/use-toast';

function useIdleGainNotification() {
  const { toast } = useToast();

  function showIdleGains(elapsed: number, gains: Record<string, number>) {
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const gainLines = Object.entries(gains)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => `${name}: +${formatNumber(value)}`)
      .join('\n');

    toast({
      title: `Welcome back! (Away for ${timeStr})`,
      description: gainLines,
      duration: 10_000,
    });
  }

  return { showIdleGains };
}
```

---

## Settings Panel

```tsx
function SettingsPanel({
  notation,
  onNotationChange,
  offlineProgress,
  onOfflineToggle,
  onSave,
  onLoad,
  onExport,
  onImport,
  lastSaved,
}: {
  notation: 'standard' | 'scientific';
  onNotationChange: (n: 'standard' | 'scientific') => void;
  offlineProgress: boolean;
  onOfflineToggle: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
  onImport: () => void;
  lastSaved: Date | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span>Number notation</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNotationChange(notation === 'standard' ? 'scientific' : 'standard')}
        >
          {notation === 'standard' ? '1.23M' : '1.23e6'}
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <span>Offline progress</span>
        <Button
          variant={offlineProgress ? 'default' : 'outline'}
          size="sm"
          onClick={onOfflineToggle}
        >
          {offlineProgress ? 'On' : 'Off'}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onSave}>Save</Button>
        <Button variant="outline" onClick={onLoad}>Load</Button>
        <Button variant="outline" onClick={onExport}>Export</Button>
        <Button variant="outline" onClick={onImport}>Import</Button>
      </div>
      {lastSaved && (
        <p className="text-muted-foreground text-xs">
          Last saved: {lastSaved.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
```

---

## Stats Page

```tsx
type GameStats = {
  totalEarned: number;
  totalSpent: number;
  totalClicks: number;
  prestigeCount: number;
  highestMultiplier: number;
  playTime: number;
  currentRunTime: number;
  fastestPrestige: number;
};

function StatsPage({ stats }: { stats: GameStats }) {
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const rows = [
    ['Total earned', formatNumber(stats.totalEarned)],
    ['Total spent', formatNumber(stats.totalSpent)],
    ['Total clicks', stats.totalClicks.toLocaleString()],
    ['Prestige count', stats.prestigeCount.toString()],
    ['Highest multiplier', `${stats.highestMultiplier.toFixed(2)}x`],
    ['Total play time', formatTime(stats.playTime)],
    ['Current run', formatTime(stats.currentRunTime)],
    ['Fastest prestige', formatTime(stats.fastestPrestige)],
  ] as const;

  return (
    <div className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between border-b py-1 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## Layout Pattern

Recommended layout for a full idle game:

```
┌─────────────────────────────────────┐
│          Resource Bar (sticky)       │
├─────────────────────────────────────┤
│  [Resources] [Upgrades] [Prestige]  │ ← Tab navigation
│  [Stats] [Settings]                 │
├─────────────────────────────────────┤
│                                     │
│         Active Tab Content          │
│    (upgrade cards, stats, etc.)     │
│                                     │
└─────────────────────────────────────┘
```

Use `max-w-2xl mx-auto` for single-column idle games or `grid grid-cols-1 md:grid-cols-2` for wider layouts with side panels.
