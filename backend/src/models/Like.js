import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

likeSchema.index({ user: 1, post: 1 }, { unique: true }); // one like per user per post
likeSchema.index({ post: 1 });

export default mongoose.models.Like || mongoose.model('Like', likeSchema);
