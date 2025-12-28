import 'server-only';

// src/server/models/ObjectModel.ts
import { Schema, Document, model, models } from 'mongoose';

export interface Object extends Document {
  name: string;
  coordinates: string;
}

const ObjectSchema = new Schema<Object>({
  name: { type: String, required: true, unique: true },
  coordinates: { type: String, required: true },
});

export default models.Object ||
  model<Object>('Object', ObjectSchema, 'objects-t2-ir');
