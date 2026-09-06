import { Schema, model } from 'mongoose';
import { docToJSON } from '../utils/serialize.js';

const projectSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#6D4FE0' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { transform: docToJSON } },
);

export const Project = model('Project', projectSchema);
