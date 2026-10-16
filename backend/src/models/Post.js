import mongoose from 'mongoose';

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Business limit (POST_MAX_LENGTH) is enforced by the validator; this is a hard safety ceiling.
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
    hashtags: { type: [String], default: [] },
    media: { type: [Schema.Types.Mixed], default: undefined, select: false }, // reserved for future media metadata
    replyTo: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    rootPost: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    ancestors: { type: [Schema.Types.ObjectId], default: [] }, // root -> direct parent, enables 1-query thread loading
    // Denormalised counters (updated with $inc only when the underlying Like/Repost/reply really changed)
    likeCount: { type: Number, default: 0, min: 0 },
    replyCount: { type: Number, default: 0, min: 0 },
    repostCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

postSchema.index({ replyTo: 1, _id: -1 });         // feed (replyTo: null) and reply lists
postSchema.index({ author: 1, _id: -1 });          // profile timelines (Phase 4)
postSchema.index({ hashtags: 1, _id: -1 });        // trending / hashtag search (Phase 5)
postSchema.index({ ancestors: 1 });                // subtree lookup for cascade delete

export default mongoose.models.Post || mongoose.model('Post', postSchema);
