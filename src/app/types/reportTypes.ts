// /app/types/reportTypes.ts

export interface BaseStatus {
  baseId: string;
  status: string;
  latestStatusChangeDate: string;
  fileCount?: number;
}

export interface IEvent {
  action: string;
  author: string;
  authorId: string;
  date: Date;
  details?: Record<string, unknown>;
}

import type { Types } from 'mongoose';

// Серверный формат IReport
export interface IReport {
  _id: string;
  orgId: Types.ObjectId | string;
  projectId?: Types.ObjectId | string;
  taskId: string;
  baseId: string;
  taskName?: string;
  files: string[];
  fixedFiles: string[];
  issues: string[];
  storageBytes?: number;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  createdById: string;
  createdByName: string;
  initiatorId?: string;
  initiatorName?: string;
  events: IEvent[];
}

export interface ReportClient {
  taskId: string;
  taskName?: string;
  bsNumber?: string;
  createdById?: string;
  createdByName?: string;
  executorName?: string;
  initiatorName?: string;
  createdAt: string;
  canDelete?: boolean;
  baseStatuses: BaseStatus[];
}

export interface ApiResponse {
  reports: ReportClient[];
  userRole?: string;
  isSuperAdmin?: boolean;
  error?: string;
}
