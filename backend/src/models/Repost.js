import mongoose from 'mongoose';

const repostSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

repostSchema.index({ user: 1, post: 1 }, { unique: true }); // one repost per user per post
repostSchema.index({ user: 1, _id: -1 });
repostSchema.index({ post: 1 });

export default mongoose.models.Repost || mongoose.model('Repost', repostSchema);
