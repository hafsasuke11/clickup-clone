import { Schema, model, type InferSchemaType } from 'mongoose';
import { idTransform } from '../utils/toJSON.js';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    company: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: idTransform } },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };

export const User = model('User', userSchema);
