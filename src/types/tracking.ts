export type CaseStatus = "Closed" | "On Process" | "Pending" | "Unspecified";

export interface TrackingRecord {
  id: number;
  date: string; // DD/MM/YYYY
  owner: string;
  shift: string;
  platform: string;
  closeTime: string;
  customer: string;
  status: CaseStatus | string;
  remark: string;
  dataEntryDone: boolean;
  saleClosed: boolean;
  upsellChecked: boolean;
  upsellResponse: string;
  product: string;
  price: number;
}

export interface DailyMetric {
  date: string;
  isoDate: string;
  shortDate: string;
  totalCases: number;
  closedCases: number;
  onProcessCases: number;
  pendingCases: number;
  closingRate: number;
  upsellAttempts: number;
  upsellAccepted: number;
  upsellAttemptRate: number;
  revenue: number;
  aov: number;
  anomalyCount: number;
}

export interface PlatformMetric {
  platform: string;
  total: number;
  closed: number;
  onProcess: number;
  pending: number;
  closingRate: number;
  upsellAttempts: number;
  upsellAccepted: number;
  upsellAttemptRate: number;
  revenue: number;
  aov: number;
}

export interface StaffMetric {
  owner: string;
  total: number;
  closed: number;
  onProcess: number;
  pending: number;
  closingRate: number;
  dataEntryRate: number;
  upsellAttempts: number;
  upsellAccepted: number;
  upsellAttemptRate: number;
  upsellWinRate: number;
  revenue: number;
  aov: number;
  anomalyCount: number;
  efficiencyScore: number;
  primaryBottleneck: string;
}

export interface ShiftMetric {
  shift: string;
  total: number;
  closed: number;
  onProcess: number;
  closingRate: number;
  upsellAttemptRate: number;
  revenue: number;
  overrunCount: number;
}

export interface ProductMetric {
  product: string;
  count: number;
  accepted: number;
  declined: number;
  acceptRate: number;
  revenue: number;
}

export type SeverityLevel = "critical" | "high" | "medium";

export interface DiagnosticProblem {
  id: string;
  title: string;
  category: string;
  severity: SeverityLevel;
  affectedCount: number;
  affectedPct: number;
  estimatedImpactThb: number;
  rootCauseSummary: string;
  solutionTitle: string;
  solutionDescription: string;
  actionSteps: Array<{
    step: string;
    ownerRole: string;
    timeframe: string;
    expectedEffect: string;
  }>;
  kpiTargetLabel: string;
  evidenceRows: TrackingRecord[];
  evidenceSnippets: string[];
}

export interface AnalyticsSummary {
  totalCases: number;
  closedCases: number;
  onProcessCases: number;
  pendingCases: number;
  unspecifiedCases: number;
  closingRate: number;
  dataEntryRate: number;
  upsellAttemptCount: number;
  upsellAttemptRate: number;
  upsellAcceptedCount: number;
  upsellDeclinedCount: number;
  upsellWinRate: number;
  totalRevenue: number;
  pricedOrdersCount: number;
  avgOrderValue: number;
  upsellAvgOrderValue: number;
  nonUpsellAvgOrderValue: number;
  unpricedClosedCount: number;
  shiftOverrunCount: number;
  periodStart: string;
  periodEnd: string;
  dailyMetrics: DailyMetric[];
  platformMetrics: PlatformMetric[];
  staffMetrics: StaffMetric[];
  shiftMetrics: ShiftMetric[];
  productMetrics: ProductMetric[];
  problems: DiagnosticProblem[];
}

export interface ImprovementLevers {
  targetClosingRateLiftPct: number; // e.g. +10 percentage points
  targetUpsellAttemptPct: number; // e.g. 70% of closed orders
  targetUpsellWinRatePct: number; // e.g. 30% acceptance when pitched
  slaRecoveryPct: number; // e.g. recover 40% of stalled/slow-response lost deals
}

export interface SimulationOutput {
  baselineRevenue: number;
  projectedRevenue: number;
  revenueLiftThb: number;
  revenueLiftPct: number;
  baselineClosed: number;
  projectedClosed: number;
  additionalClosedCases: number;
  additionalUpsellOrders: number;
  dailyComparison: Array<{
    shortDate: string;
    date: string;
    baselineRevenue: number;
    projectedRevenue: number;
    baselineClosed: number;
    projectedClosed: number;
  }>;
}

export interface AIDiagnosticReport {
  executiveSummary: string;
  criticalBottlenecks: Array<{
    problemTitle: string;
    rootCause: string;
    quantifiedImpact: string;
    solutionStrategy: string;
    immediateSteps: string[];
    kpiTarget: string;
  }>;
  thirtyDayRoadmap: Array<{
    phase: string;
    focus: string;
    actions: string[];
    expectedOutcome: string;
  }>;
}
