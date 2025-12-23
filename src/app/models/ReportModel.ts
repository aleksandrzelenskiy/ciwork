// /app/models/ReportModel.ts
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
  taskId: { type: String, required: true },
  task: { type: String, default: '' },
  reportId: { type: String }, // legacy field
  baseId: { type: String, required: true },
  files: { type: [String], default: [] },
  fixedFiles: { type: [String], default: [] },
  issues: { type: [String], default: [] },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
  executorId: { type: String, required: true },
  executorName: { type: String, default: 'Unknown' },
  initiatorId: { type: String, required: true },
  initiatorName: { type: String, default: 'initiator' },
  events: { type: [EventSchema], default: [] },
});

// If the model already exists, use it; otherwise, create a new one.
const ReportModel =
  mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);

export default ReportModel;
