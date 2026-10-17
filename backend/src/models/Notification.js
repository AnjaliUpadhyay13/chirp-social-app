import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = ['like', 'repost', 'reply', 'follow'];

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    // like/repost: the post that was liked/reposted. reply: the reply itself. follow: null.
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The same actor can't create the same notification twice (spam guard; undo + redo is handled by deleting on undo)
notificationSchema.index({ recipient: 1, actor: 1, type: 1, post: 1 }, { unique: true });
notificationSchema.index({ recipient: 1, _id: -1 });      // list
notificationSchema.index({ recipient: 1, readAt: 1 });    // unread count
notificationSchema.index({ post: 1 });                    // cascade delete

export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
