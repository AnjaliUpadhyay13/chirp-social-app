import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bookmarkSchema.index({ user: 1, post: 1 }, { unique: true }); // one bookmark per user per post
bookmarkSchema.index({ user: 1, _id: -1 });                    // "my bookmarks", newest first
bookmarkSchema.index({ post: 1 });                             // cascade delete

export default mongoose.models.Bookmark || mongoose.model('Bookmark', bookmarkSchema);
