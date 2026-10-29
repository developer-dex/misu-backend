import { Schema, model } from 'mongoose';

/** Someone who can log in to the app. Only a scrypt hash of the password is stored. */
const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 40 },
    passwordHash: { type: String, required: true },
    // Bumped when the password changes, so tokens issued before it stop working
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
