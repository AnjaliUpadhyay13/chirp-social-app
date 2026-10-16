import mongoose from 'mongoose';

const followSchema = new mongoose.Schema(
  {
    follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

followSchema.index({ follower: 1, following: 1 }, { unique: true }); // one follow per pair
followSchema.index({ following: 1, _id: -1 });                        // "followers of X" pages
followSchema.index({ follower: 1, _id: -1 });                         // "who X follows" pages

export default mongoose.models.Follow || mongoose.model('Follow', followSchema);
