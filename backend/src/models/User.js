import mongoose from 'mongoose';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 }, // validator enforces 50 characters
    username: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
      match: [USERNAME_RE, 'Username must be 3-20 characters: letters, numbers, underscore'],
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false }, // never returned unless explicitly selected
    bio: { type: String, default: '', maxlength: 640 }, // validator enforces 160 characters
    avatar: { type: String, default: '', maxlength: 500 },
    followerCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash; // defence in depth
        return ret;
      },
    },
  },
);

export default mongoose.models.User || mongoose.model('User', userSchema);
