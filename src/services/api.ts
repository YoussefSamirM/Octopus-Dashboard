// ============================================
// WFM Platform — API Service Layer
// Clean abstraction over all backend endpoints
// ============================================

import type {
  BufferResult,
  ShapeResult,
  ActivityRequest,
  TardyRequest,
  BatchOperationResponse,
  BreakHandlingLogic,
  ActivityType,
} from '@/types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data.error || data.message || 'Request failed');
  }

  if (data.error) {
    throw new ApiError(res.status, data.error);
  }

  return data as T;
}

// ─── Auth ───

export async function verifyToken(token: string): Promise<{ valid: boolean; message?: string }> {
  return request('/verify-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// ─── Staffing ───

export async function fetchStaffingBuffer(
  token: string,
  date: string,
  interval: string,
  lobConfig: Record<string, string[]>
): Promise<BufferResult[]> {
  return request('/staffing/buffer', {
    method: 'POST',
    body: JSON.stringify({ token, date, interval, lobConfig }),
  });
}

export async function fetchShapeAnalysis(
  token: string,
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  lobConfig: Record<string, string[]>
): Promise<ShapeResult> {
  return request('/staffing/shape', {
    method: 'POST',
    body: JSON.stringify({ token, startDate, startTime, endDate, endTime, lobConfig }),
  });
}

// ─── Operations ───

export async function executeActivity(
  token: string,
  requests: ActivityRequest[],
  activityName: ActivityType,
  breakHandlingLogic: BreakHandlingLogic,
  isSimulation: boolean
): Promise<BatchOperationResponse> {
  return request('/activity', {
    method: 'POST',
    body: JSON.stringify({
      token,
      requests,
      activityName,
      breakHandlingLogic,
      isSimulation,
    }),
  });
}

export async function executeTardy(
  token: string,
  requests: TardyRequest[],
  isSimulation: boolean
): Promise<BatchOperationResponse> {
  return request('/tardy', {
    method: 'POST',
    body: JSON.stringify({ token, requests, isSimulation }),
  });
}

export async function executeUndo(
  token: string,
  opId: string
): Promise<{ message: string }> {
  return request('/undo', {
    method: 'POST',
    body: JSON.stringify({ token, opId }),
  });
}
