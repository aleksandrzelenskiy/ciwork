import 'server-only';

// src/server/models/TaskModel.ts

import mongoose, { Schema, Document, model } from 'mongoose';
import { Task, PriorityLevel, CurrentStatus } from '@/app/types/taskTypes';
import { dispatchTaskEvent } from '@/server/integrations/webhook';

const TaskSchema = new Schema<Task & Document>({
  orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: false, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: false, index: true },
  taskId: { type: String, required: true },
  taskName: { type: String, required: true },
  bsNumber: { type: String, required: true },
  bsLocation: [
    {
      name: String,
      coordinates: String,
      address: String,
    },
  ],
  bsAddress: { type: String, required: true },
  totalCost: { type: Number, required: false },
  workItems: [
    {
      workType: String,
      quantity: Number,
      unit: String,
      note: String,
    },
  ],
  taskDescription: { type: String },
  authorId: { type: String },
  authorName: { type: String },
  authorEmail: { type: String },
  initiatorName: { type: String },
  initiatorEmail: { type: String },
  executorId: { type: String },
  executorName: { type: String },
  executorEmail: { type: String },
  dueDate: { type: Date },
  priority: {
    type: String,
    enum: ['urgent', 'high', 'medium', 'low'] as PriorityLevel[],
    default: 'medium',
    required: true,
  },
  status: {
    type: String,
    enum: [
      'To do',
      'Assigned',
      'At work',
      'Done',
      'Pending',
      'Issues',
      'Fixed',
      'Agreed',
    ] as CurrentStatus[],
    default: 'To do',
  },

  // Тип задачи (строительная, инсталляционная или документальная)
  taskType: {
    type: String,
    enum: ['construction', 'installation', 'document'],
    required: true,
    default: 'installation',
  },

  // Какие вложения возможны
  requiredAttachments: [
    {
      type: String,
      enum: ['photo', 'pdf', 'doc', 'xlsm', 'xlsx', 'dwg'],
    },
  ],

  // Маркетплейс параметры
  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private',
    index: true,
  },
  publicStatus: {
    type: String,
    enum: ['open', 'in_review', 'assigned', 'closed'],
    default: 'open',
    index: true,
  },
  budget: { type: Number },
  publicDescription: { type: String },
  currency: { type: String, default: 'RUB' },
  skills: { type: [String], default: [] },
  applicationCount: { type: Number, default: 0 },
  acceptedApplicationId: { type: String },
  allowInstantClaim: { type: Boolean, default: false },
  contractorPayment: { type: Number },

  // Ссылки на связанные задачи (для зависимостей и макро-задач)
  relatedTasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],

  // Вложения (фото или файлы)
  attachments: [
    {
      type: String,
      required: false,
    },
  ],

  // Поля согласования
  approvedBy: { type: String }, // ID или имя инициатора, согласовавшего задачу
  approvedAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
  orderUrl: { type: String },
  orderNumber: { type: String },
  orderDate: { type: Date },
  orderSignDate: { type: Date },
  ncwUrl: { type: String, required: false, default: '' },        // ссылка на PDF в S3
  workCompletionDate: { type: Date, required: false },           // дата окончания работ (= дата уведомления)
  closingDocumentsUrl: { type: String },
  payment: {
    orgMarkedPaidAt: { type: Date },
    orgMarkedPaidBy: { type: String },
    contractorConfirmedAt: { type: Date },
    contractorConfirmedBy: { type: String },
  },

  // История событий
  events: [
    {
      action: { type: String, required: true }, // Тип действия
      author: { type: String, required: true }, // Имя автора изменения
      authorId: { type: String, required: true }, // ID автора изменения
      date: { type: Date, default: Date.now }, // Дата изменения
      details: { type: Schema.Types.Mixed }, // Детали изменения
    },
  ],

  // Комментарии
  comments: [
    {
      _id: { type: String, required: true },
      text: { type: String, required: true },
      author: { type: String, required: true },
      authorId: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      photoUrl: { type: String },
      profilePic: { type: String },
    },
  ],

  // Документы (например, сметы)
  documents: [
    {
      type: String,
      required: false,
    },
  ],
});

TaskSchema.pre('save', function preSave(next) {
  this.$locals.wasNew = this.isNew;
  next();
});

TaskSchema.post('save', function postSave(doc) {
  const wasNew = Boolean(this.$locals?.wasNew);
  const eventType = wasNew ? 'task.created' : 'task.updated';
  const orgId = doc?.orgId ?? undefined;
  const projectId = doc?.projectId ?? undefined;
  void dispatchTaskEvent({ eventType, task: doc, orgId, projectId }).catch((error) => {
    console.error('Failed to dispatch task event:', error);
  });
});

TaskSchema.post('findOneAndUpdate', async function postFindOneAndUpdate(doc) {
  try {
    const updated = doc || (await this.model.findOne(this.getFilter()));
    if (!updated) return;
    const orgId = updated?.orgId ?? undefined;
    const projectId = updated?.projectId ?? undefined;
    await dispatchTaskEvent({ eventType: 'task.updated', task: updated, orgId, projectId });
  } catch (error) {
    console.error('Failed to dispatch task update event:', error);
  }
});

TaskSchema.post('updateOne', async function postUpdateOne() {
  try {
    const updated = await this.model.findOne(this.getFilter());
    if (!updated) return;
    const orgId = updated?.orgId ?? undefined;
    const projectId = updated?.projectId ?? undefined;
    await dispatchTaskEvent({ eventType: 'task.updated', task: updated, orgId, projectId });
  } catch (error) {
    console.error('Failed to dispatch task update event:', error);
  }
});

TaskSchema.post('updateMany', async function postUpdateMany() {
  try {
    const updatedDocs = await this.model.find(this.getFilter());
    if (!updatedDocs.length) return;
    await Promise.all(
      updatedDocs.map((doc: typeof updatedDocs[number]) => {
        const orgId = doc?.orgId ?? undefined;
        const projectId = doc?.projectId ?? undefined;
        return dispatchTaskEvent({ eventType: 'task.updated', task: doc, orgId, projectId });
      })
    );
  } catch (error) {
    console.error('Failed to dispatch task bulk update events:', error);
  }
});

TaskSchema.post('findOneAndDelete', function postFindOneAndDelete(doc) {
  if (!doc) return;
  const orgId = doc?.orgId ?? undefined;
  const projectId = doc?.projectId ?? undefined;
  void dispatchTaskEvent({ eventType: 'task.deleted', task: doc, orgId, projectId }).catch((error) => {
    console.error('Failed to dispatch task delete event:', error);
  });
});

const MODEL_NAME = 'Task';

const mutableModels = mongoose.models as unknown as Record<string, mongoose.Model<unknown>>;

if (mutableModels[MODEL_NAME]) {
  delete mutableModels[MODEL_NAME];
}

export default model<Task & Document>(MODEL_NAME, TaskSchema);
