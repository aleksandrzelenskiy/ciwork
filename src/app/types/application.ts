// src/app/types/application.ts

export type ApplicationStatus =
  | 'submitted'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface TaskApplication {
  _id?: string;
  taskId: string;
  orgId: string;
  contractorId: string;
  contractorClerkUserId?: string;
  contractorEmail?: string;
  contractorName?: string;
  coverMessage: string;
  proposedBudget: number;
  etaDays?: number;
  attachments?: string[];
  status: ApplicationStatus;
  createdAt?: string;
  updatedAt?: string;
}
