import 'server-only';

// src/server/models/ReportModel.ts
import mongoose, { Schema } from 'mongoose';
import { IReport, IEvent } from '../types/reportTypes';

// Schema for a single history event (Event).
const EventSchema = new Schema<IEvent>(
  {
    action: { type: String, required: true },
    author: { type: String, required: true },
    authorId: { type: String },
    date: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

// Main report schema
const ReportSchema = new Schema<IReport>({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  taskId: { type: String, required: true, index: true },
  baseId: { type: String, required: true, index: true },
  taskName: { type: String, default: '' },
  files: { type: [String], default: [] },
  fixedFiles: { type: [String], default: [] },
  issues: { type: [String], default: [] },
  storageBytes: { type: Number, default: 0 },
  status: { type: String, default: 'Pending' },
  createdById: { type: String, required: true },
  createdByName: { type: String, default: 'Unknown' },
  initiatorName: { type: String, default: 'initiator' },
  events: { type: [EventSchema], default: [] },
}, { timestamps: true });

// If the model already exists, use it; otherwise, create a new one.
ReportSchema.index({ taskId: 1, baseId: 1 }, { unique: true });

const ReportModel =
  mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);

export default ReportModel;
