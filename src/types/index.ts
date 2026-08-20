// ============================================
// WFM Platform — Shared Type Definitions
// Calabrio API contracts & application types
// ============================================

// ─── Calabrio API Types ───

export interface CalabrioTimePeriod {
  StartTime: string;
  EndTime: string;
}

export interface CalabrioDatePeriod {
  StartDate: string;
  EndDate: string;
}

export interface ShiftLayer {
  Period: CalabrioTimePeriod;
  ActivityId?: string | null;
  AbsenceId?: string | null;
  Overtime?: Record<string, unknown> | null;
}

export interface ShiftCategory {
  Id: string;
  Name?: string;
}

export interface FullDayAbsence {
  AbsenceId?: string;
  Id?: string;
}

export interface PartDayAbsence {
  Period: CalabrioTimePeriod;
  AbsenceId?: string;
}

export interface ScheduleDay {
  Date: string;
  Shift?: ShiftLayer[];
  DayOff?: boolean;
  ShiftCategory?: ShiftCategory | null;
  FullDayAbsences?: FullDayAbsence[];
  PartDayAbsences?: PartDayAbsence[];
}

export interface PersonResult {
  Id: string;
  EmploymentNumber: string;
  FirstName?: string;
  LastName?: string;
}

export interface SkillResult {
  Id: string;
  Name: string;
}

export interface StaffingItem {
  Period: CalabrioTimePeriod;
  ForecastedAgents: number;
  ScheduledAgents: number;
  ForecastedAgentsWithShrinkage: number;
  ScheduledAgentsWithShrinkage: number;
}

// ─── Application Types ───

export interface BufferResult {
  lob: string;
  forecast: number;
  scheduled: number;
  diff: number;
  forecastShrink: number;
  scheduledShrink: number;
  diffShrink: number;
}

export interface ShapeRow {
  time: string;
  [lob: string]: number | string;
}

export interface ShapeResult {
  lobs: string[];
  normal: ShapeRow[];
  shrink: ShapeRow[];
}

export interface ActivityRequest {
  empId: string;
  date: string;
  start: string;
  end: string;
}

export interface TardyRequest {
  empId: string;
  loginTime: string;
}

export interface OperationResult {
  empId: string;
  status: string;
  color: 'success' | 'danger' | 'warning' | 'info';
}

export interface BatchOperationResponse {
  results: OperationResult[];
  opId: string | null;
}

export type BreakHandlingLogic = 'Wrap' | 'Shift breaks forward' | 'Cancel if overlapping a break';

export type ActivityType =
  | 'Coaching'
  | 'Overage'
  | 'OverTime by RTM'
  | 'TR Sessions'
  | 'RF Session'
  | 'Nesting'
  | 'Test'
  | 'Support'
  | 'Extar Break'
  | 'Toilet'
  | 'Health Issue'
  | 'Offline'
  | 'Offline +1'
  | 'Live task';

// ─── UI State Types ───

export type TabId = 'dashboard' | 'buffer' | 'shape' | 'smart-actions' | 'activity' | 'tardy' | 'settings' | 'data' | 'reports' | 'brightskies' | 'ic-view' | 'admin-upload';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface NavigationItem {
  id: TabId;
  label: string;
  icon: string;
  description?: string;
  badge?: string;
}
