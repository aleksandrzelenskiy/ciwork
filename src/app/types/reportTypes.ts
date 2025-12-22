// /app/types/reportTypes.ts

export interface BaseStatus {
  baseId: string;
  status: string;
  latestStatusChangeDate: string;
}

export interface IEvent {
  action: string;
  author: string;
  authorId: string;
  date: Date;
  details?: Record<string, unknown>;
}

// Серверный формат IReport
export interface IReport {
  _id: string;
  reportId: string;
  task: string;
  baseId: string;
  files: string[];
  fixedFiles: string[];
  issues: string[];
  status: string;
  createdAt: Date;
  executorId: string;
  executorName: string;
  initiatorId: string;
  initiatorName: string;
  events: IEvent[];
}

export interface ReportClient {
  reportId: string;
  task: string;
  authorId?: string;
  executorId?: string;
  executorName?: string;
  initiatorId?: string;
  initiatorName?: string;
  reviewerName?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  createdAt: string;
  baseStatuses: BaseStatus[];
}

export interface ApiResponse {
  reports: ReportClient[];
  userRole?: string;
  isSuperAdmin?: boolean;
  error?: string;
}
