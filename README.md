# Chirp - Twitter-inspired social app (MERN)

Full-stack social media app: React + Vite frontend, Express + MongoDB backend, REST API under `/api/v1`.
"Chirp" is a working name; change it in `frontend/index.html`, `LeftNav.jsx`, `MainLayout.jsx`.

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: scaffolds, env, Mongo config, security middleware, responsive layout, theme, toasts, states | **Done** |
| 2 | Authentication: register, login, logout, session restore, protected routes (frontend + API) | **Done** |
| 3 | Posts, feed (load more), delete, likes, replies/threads, reposts | **Done** |
| 4 | Profiles: view/edit, follow/unfollow, followers/following lists, profile tabs, "Following" timeline | **Done** |
| 5 | Bookmarks, search (people + posts), trending hashtags, suggested users, notifications with unread badge | **Done** |
| 6 | Polish, accessibility, final tests | Planned |

## Prerequisites

- Node.js 18+ (20 LTS recommended)
- MongoDB running locally (`mongodb://127.0.0.1:27017`) **or** a free MongoDB Atlas cluster
- Git

## Setup (Windows PowerShell)

```powershell
# 1. Install everything
npm run install:all

# 2. Backend env
Copy-Item backend\.env.example backend\.env
# open backend\.env and set MONGODB_URI (Atlas users: paste the mongodb+srv:// string)

# 3. Frontend env (optional in dev - the Vite proxy handles /api)
Copy-Item frontend\.env.example frontend\.env
```

## Run (two terminals)

```powershell
# Terminal 1 - API on http://localhost:5001
npm run dev:backend

# Terminal 2 - UI on http://localhost:5173
npm run dev:frontend
```

Open http://localhost:5173. The Home page shows a live "Backend connection" card
(API status, database state, uptime) so you can confirm everything is wired.

Quick API check: `Invoke-RestMethod http://localhost:5001/api/v1/health`

### Port already in use (EADDRINUSE)

```powershell
netstat -ano | findstr :5001
taskkill /PID <PID> /F
```
Or change `PORT` in `backend\.env` and `VITE_PROXY_TARGET` in `frontend\.env`.

## Tests

```powershell
npm test                      # backend + frontend
npm --prefix backend test     # API integration tests (Vitest + Supertest + real MongoDB): auth, posts, users/follows, bookmarks, notifications, search
npm --prefix frontend test    # component/flow tests (Vitest + Testing Library)
```

Backend tests need a MongoDB. By default they start an **in-memory MongoDB**
(`mongodb-memory-server`; the first run downloads a `mongod` binary, so it needs internet and takes a minute).
To use your own MongoDB instead, point the tests at it (each run uses its own throwaway database and drops it):

```powershell
$env:TEST_MONGODB_URI = "mongodb://127.0.0.1:27017"
npm --prefix backend test
```

### Manual test checklist (Phase 5: bookmarks, search, trending, notifications)

Use two accounts again (A normal window, B incognito).

1. A posts `Learning #mern today`. B posts `#mern is fun` and `#react rocks`. Right sidebar **Trends for you** now lists `#mern` (2 people) first. Click it -> **Explore** opens with both posts.
2. **Explore** with an empty box shows *Trending hashtags* and *Who to follow*. Type `mern` -> results appear after a short pause. Switch to the **People** tab, search `rohan` (or any username/name) and follow from the results.
3. In search try `.*`, `(` and `[a-z` -> no crash, no results (they are matched literally).
4. B follows A -> A's **Notifications** item in the left nav shows a badge (1). B likes A's post, reposts it and replies -> badge 4. Like, unlike, like again -> still only one *liked your post* entry.
5. A opens **Notifications**: unread ones are highlighted. Click one -> it opens the post/profile, the highlight goes and the badge drops by one. **Mark all as read** clears the badge.
6. B unfollows A -> A's "followed you" notification disappears. A deletes the liked post -> its like/reply notifications disappear.
7. B clicks the bookmark icon on a post -> toast *Saved to your bookmarks*. **Bookmarks** page lists it; the page says only you can see it. Remove it there -> it leaves the list. A's Bookmarks page never shows B's saves.
8. **Who to follow** in the sidebar and on Explore never shows yourself or people you already follow. Follow from there -> button flips to *Following*.
9. Stop the backend -> sidebar cards show *Couldn't load ... Retry*, Explore/Notifications/Bookmarks show an error with **Try again**; restart and retry works.

### Manual test checklist (Phase 4: profiles and follows)

Use the same two accounts (A normal window, B incognito).

1. Click **Profile** in the left nav -> your profile (`/<username>`): name, @handle, "Joined <month year>", Following / Followers counts, tabs **Posts** and **Replies**.
2. **Edit profile** -> change name and bio, paste an image URL as avatar -> Save. Header, nav and your posts show the new name/avatar after a refresh. Try a 161-character bio -> error, nothing is sent. Try `javascript:alert(1)` as avatar -> rejected.
3. B opens `/<A's username>` -> sees A's profile with a **Follow** button and no Edit button. Click Follow -> button becomes **Following** (hover shows *Unfollow*), A's follower count +1. Refresh -> still following.
4. A opens B's profile -> B's page shows **Follows you** (A has not followed back yet).
5. B opens `/<A>/followers` -> sees themselves (without a Follow button on their own row). A opens `/<A>/followers` and follows B back from the list.
6. A tries to open `/<A>` -> no Follow button on your own profile. (API check: `POST /users/<your username>/follow` returns 400.)
7. A posts something. B's **Home -> Following** tab shows A's post; B's **For you** tab shows everyone's.
8. B **reposts** A's post -> on B's profile the post appears with "You reposted"; B's followers see "Rohan reposted" in their Following tab. Undo the repost -> it disappears.
9. B unfollows A -> A's posts disappear from B's Following tab (they stay in For you).
10. Replies tab: A replies to someone -> A's **Replies** tab shows it with "Replying to @...".
11. Open `/some_unknown_name` -> "This account doesn't exist". Open `/ab` or `/a/b/c` -> page-not-found.

### Manual test checklist (Phase 3: posts)

Use **two accounts**: log in as user A in a normal window and user B in a private/incognito window.

1. A: write a post on Home -> it appears at the top immediately and **survives a refresh** (it is in MongoDB).
2. Composer: leave it empty / spaces only -> Post is disabled. Type past the limit -> counter turns red, Post disabled. `Ctrl + Enter` posts.
3. A: add `#mern` in a post -> the tag is highlighted.
4. B: refresh Home -> sees A's post. B **likes** it -> heart fills, count 1. Refresh -> still liked. Click again -> unliked, count 0.
5. B: **repost** and undo repost the same way. Double-click quickly -> count never goes above 1.
6. B: click A's post -> detail page. Write a **reply** -> it appears, reply count goes up. Open the reply -> A's post is shown above it as the thread parent.
7. A: open B's reply and reply back (nested conversation of 3 levels).
8. B: the "..." menu appears only on B's own posts, never on A's. Delete B's reply -> confirm dialog -> it disappears and A's reply count drops by one.
9. A: delete the main post -> its replies disappear too (cascade).
10. Create 25+ posts (or lower the page size) -> "Load more" appends older posts, no duplicates, ends with "You're all caught up".
11. Stop the backend, like a post -> the heart reverts and an error toast shows.

### Manual test checklist (Phase 1 + 2 together)

1. Open http://localhost:5173 -> you are redirected to **/login** (not logged in).
2. **Sign up** with a weak password / bad email -> inline errors, no request sent.
3. Sign up properly -> you land on **Home**, "Signed in as @username", Database card shows **connected**.
4. Refresh the page -> still logged in (session restored from the cookie).
5. Open **Explore / Notifications / Bookmarks / Profile** -> placeholders, nav highlights current page.
6. Visit /login while logged in -> redirected to Home.
7. Account menu (bottom-left on desktop, avatar top-right on mobile) -> **Log out** -> back at /login; Back button / refresh does not restore the session.
8. Sign up again with the same email/username -> field errors from the server.
9. Log in with wrong password -> generic "Invalid email/username or password".
10. Toggle dark mode; resize the window (desktop -> tablet -> mobile with bottom nav).
11. Stop the backend -> Home shows an error card with **Try again**.

## Project structure

```
backend/src
  config/       env validation (zod), db connection, CORS
  middleware/   auth (requireAuth/optionalAuth), validate, rateLimit, notFound, errorHandler
  routes/       /api/v1 router (health, config, auth)
  models/       User, Post, Like, Repost, Follow, Bookmark, Notification
  validators/   auth, post, user, search (zod)
  services/     auth (register/login, Argon2id), post (feed, threads, likes, reposts, delete),
                timeline (posts + reposts merge, following feed), user (profile, follow, lists, suggestions),
                bookmark, notification (create/withdraw/list/read), search (people, posts, trending)
  controllers/  auth, post, user, notification, search
  utils/        ApiError, asyncHandler, response envelope
frontend/src
  components/   Button, Avatar, Skeleton, EmptyState, ErrorState, FormField, Dropdown, Modal, Tabs, Composer, PostCard, PostList, FollowButton, UserRow, SuggestedUser, TrendItem, EditProfileModal, UserMenu, ProtectedRoute, nav pieces
  layouts/      MainLayout (3-column / tablet / mobile), AuthLayout
  pages/        Login, Register, Home (For you / Following), PostDetail, Profile, FollowList, Explore, Bookmarks, Notifications
  context/      ThemeContext, ToastContext, AuthContext, NotificationContext (unread badge)
  services/     api.js (fetch wrapper, cookies included), auth.js, posts.js, users.js, search.js, notifications.js
  hooks/        usePaginatedPosts, usePostLimit, useDebounce, useRemote, useApiHealth
  styles/       tokens, base, layout, components
```

## API conventions

Success: `{ "success": true, "data": ..., "meta": { "nextCursor": ... } }`
Error:   `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }`

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/health` | - | API status, database state, uptime |
| GET | `/api/v1/config` | - | Public settings (`postMaxLength`) |
| POST | `/api/v1/auth/register` | - | Create account, sets session cookie. Body: `name, username, email, password` |
| POST | `/api/v1/auth/login` | - | Body: `identifier` (email or username), `password`. Sets session cookie |
| POST | `/api/v1/auth/logout` | - | Clears the session cookie |
| GET | `/api/v1/auth/me` | required | Current user (used to restore the session on page load) |
| POST | `/api/v1/posts` | required | Create a post. Body: `{ text }` (max `POST_MAX_LENGTH`) |
| GET | `/api/v1/posts/feed?limit=&cursor=` | required | Top-level posts, newest first. `meta.nextCursor` for the next page |
| GET | `/api/v1/posts/:id` | required | Post + `ancestors` (thread parents, root first) |
| DELETE | `/api/v1/posts/:id` | owner only | Deletes the post, its replies, likes and reposts |
| GET | `/api/v1/posts/:id/replies?limit=&cursor=` | required | Direct replies, oldest first |
| POST | `/api/v1/posts/:id/replies` | required | Reply. Body: `{ text }` |
| POST / DELETE | `/api/v1/posts/:id/like` | required | Like / unlike (idempotent). Returns `{ liked, likeCount }` |
| POST / DELETE | `/api/v1/posts/:id/repost` | required | Repost / undo (idempotent). Returns `{ reposted, repostCount }` |
| GET | `/api/v1/posts/feed?scope=following` | required | You + people you follow (posts and their reposts). `scope=global` (default) = everyone |
| POST / DELETE | `/api/v1/posts/:id/bookmark` | required | Bookmark / remove (idempotent). Returns `{ bookmarked }` |
| GET | `/api/v1/bookmarks?limit=&cursor=` | required | **Your own** bookmarks, newest bookmark first |
| GET | `/api/v1/search?q=&type=posts\|users&limit=&cursor=` | required | `type=posts` (default): text match, or exact hashtag for `#tag`; cursor-paginated. `type=users`: username/name match, capped list |
| GET | `/api/v1/search/trending?limit=` | required | `{ trends: [{ tag, posts, authors }] }` for the last 7 days |
| GET | `/api/v1/users/suggestions?limit=` | required | People you don't follow yet (not you), most-followed first |
| GET | `/api/v1/notifications?limit=&cursor=` | required | **Your** notifications, newest first: `{ id, type, actor, post, readAt, createdAt }` |
| GET | `/api/v1/notifications/unread-count` | required | `{ unreadCount }` |
| PATCH | `/api/v1/notifications/:id/read` | owner only | Mark one read (someone else's id -> 404) |
| PATCH | `/api/v1/notifications/read-all` | required | Mark all of yours read |
| GET | `/api/v1/users/:username` | required | Public profile + `viewer: { isMe, following, followedBy }` (no email) |
| PATCH | `/api/v1/users/me` | self only | Edit `name`, `bio` (max 160), `avatar` (http/https URL or empty). Anything else -> 400 |
| GET | `/api/v1/users/:username/posts` | required | Their top-level posts **and reposts** (`repostedBy` set on reposts), cursor-paginated |
| GET | `/api/v1/users/:username/replies` | required | Their replies, each with `replyingTo` (username) |
| GET | `/api/v1/users/:username/followers` / `/following` | required | `{ users: [...] }` with `viewer.following`, cursor-paginated |
| POST / DELETE | `/api/v1/users/:username/follow` | required | Follow / unfollow (idempotent). Self-follow -> 400. Returns `{ following, followerCount }` |

Timeline items (profile Posts tab, Following feed) also carry `feedId` (unique per entry) and, for reposts, `repostedBy`.
Every post object: `{ id, text, hashtags, author:{id,name,username,avatar}, replyTo, rootPost, likeCount, replyCount, repostCount, createdAt, viewer:{liked,reposted,bookmarked} }`.
Author emails and password hashes are never included.

Status codes: `201` created, `400` validation (`error.details[]` = `{field, message}`), `401` not logged in / bad credentials,
`403` not allowed (e.g. deleting someone else's post), `404` not found, `409` duplicate email or username, `429` rate limited.

**Postman:** call `register` or `login` once; Postman stores the `sid` cookie automatically and sends it on later requests.

## Authentication design

- Passwords hashed with **Argon2id** (OWASP-minimum parameters). Hashes are `select: false` in the schema and stripped in `toJSON`.
- Session = signed JWT (HS256, `JWT_EXPIRES_IN`, default 7 days) in an **httpOnly** cookie (`Secure` in production,
  `SameSite=Lax` in dev / `Strict` in production). JavaScript can't read it, so XSS can't steal it. Nothing is stored in localStorage.
- `requireAuth` re-loads the user from the DB on every request, so deleted users lose access immediately.
- Login returns the same error for "unknown user" and "wrong password" and does equal hashing work for both (no user enumeration by message or timing).
- Validation is strict (Zod): unknown fields are rejected (mass-assignment), and operator objects such as `{"$ne":null}` are rejected as non-strings.
- Auth endpoints have a stricter rate limit (20 requests / 15 min / IP) on top of the global limiter.
- Duplicate protection is two-layered: friendly pre-check plus **unique indexes** (verified with a concurrent-registration test).
- Reserved usernames (`admin`, `explore`, `login`, ...) are blocked so they can't clash with app routes.
- Frontend route guards are UX only; every protected API enforces auth on the server.

## Security baseline (in place now)

Helmet headers, strict CORS allow-list with credentials, JSON body limit (10kb), NoSQL-injection
sanitising, global rate limit, env validation (refuses default JWT secret in production),
secrets only via `.env` (git-ignored).

## Posts design (Phase 3)

- **Feed** = all users' top-level posts (replies excluded), newest first. Phase 4 adds a "Following" timeline once follows exist.
- **Cursor pagination** on `_id` (ObjectIds are time-ordered): stable even when new posts arrive while you scroll; no skipped or repeated posts.
- **Replies** are posts with `replyTo` / `rootPost` / `ancestors[]`. Storing `ancestors` lets the detail page load a whole thread in one query.
- **Counters** (`likeCount`, `replyCount`, `repostCount`) are denormalised and changed with `$inc` **only when the Like/Repost row really was created or removed**, so double-clicks, retries and races can't inflate them. Unique `{user, post}` indexes are the real guard.
- **Delete** is owner-only (checked on the server) and cascades: the post, its whole reply subtree, and their likes/reposts. The parent's `replyCount` is decremented.
- **Viewer flags** (`liked`, `reposted`) are computed with two batched queries per page (no N+1).
- **Character limit** comes from `POST_MAX_LENGTH` via `/config`, counted in characters (an emoji is 1).
- Post text is stored and rendered as plain text (React escapes it), so `<script>` in a post is harmless.
- Optimistic UI for like/repost with server reconciliation and rollback on failure.

## Bookmarks, search and notifications design (Phase 5)

- **Bookmarks** are private by construction: the only read endpoint is `GET /bookmarks` and it always filters on the logged-in user. There is no bookmark count anywhere. Unique `{user, post}` index = no duplicates; deleting a post removes its bookmarks.
- **Notifications** (`like`, `repost`, `reply`, `follow`) are created inside the same services that perform the action, only when the underlying row was really created (so double-clicks don't spam), never for your own actions, and **withdrawn when you undo** (unlike / unrepost / unfollow). Deleting a post removes the notifications that point at it. A unique `{recipient, actor, type, post}` index is the last line of defence. Notification failures are logged and never break the like/reply/follow itself.
- **Access control:** every notification query is scoped to the recipient; another user's notification id behaves like a missing one (404).
- **Unread badge:** the frontend refreshes the count on login, every 30 s while the tab is visible and when the window regains focus (polling, not websockets).
- **Search** escapes the text and matches it literally (no regex injection). `#tag` searches use the indexed hashtag field; other text is a case-insensitive substring match. People search ranks exact username > prefix > partial, then by followers. The search box is debounced and the query lives in the URL (`/explore?q=...&tab=people`), so results are shareable and hashtags in posts link straight to them.
- **Trending** = hashtags of the last 7 days, ranked by how many *different people* used them (so one person spamming a tag can't trend it), then by post count.
- **Suggested users** = not you, not already followed, most-followed first.

## Profiles and follows design (Phase 4)

- **Follow** is its own collection with a unique `{follower, following}` index; follower/following counters on `User` change only when a row is really created or removed (idempotent, race-safe, never negative). Self-follow is blocked on the server.
- **Profile edit** accepts only `name`, `bio`, `avatar` (strict schema: username, email, counters and password cannot be changed). Avatar must be an http(s) URL, so `javascript:`/`data:` URLs are rejected. File upload is out of scope for v1.
- **Public vs private data:** other people's profiles never include email; only `/auth/me` and the edit response return it, and only for yourself.
- **Timelines mix posts and reposts.** Both collections use time-ordered ids, so the server fetches `limit+1` from each, merges by id and keeps `limit`; the cursor is the last entry's id. Pages stay stable with no gaps or duplicates. Used by the profile **Posts** tab and the **Following** feed.
- **Following feed** = your posts + posts/reposts of everyone you follow (top-level only). The **For you** feed stays global.
- **Reserved usernames** now also include `post`, `users`, `followers`, `following`, `static`, ... so `/:username` pages can't clash with other routes.
- Frontend: `/:username`, `/:username/followers`, `/:username/following`; `/profile` redirects to your own page. Follow buttons are optimistic with rollback.

## Decisions

- httpOnly JWT cookie + Argon2id; Zod for validation.
- Reposts get their own collection; counters on posts are denormalised and updated with `$inc`.
- Cursor pagination for feeds. Media uploads are out of scope for v1.
- Plain CSS with CSS variables (light/dark via `data-theme`). **Theme:** deep-navy surfaces, vivid orange accent, teal/green status colours; dark is the default look (saved in `localStorage` as `chirp-theme`). All colours live in `frontend/src/styles/tokens.css`, so re-theming means editing that one file. `--on-accent` is the text colour on orange buttons (white by default; set it to `#1a0f05` for higher contrast).

## Known limitations (so far)

- Counters are kept in step with `$inc`, not in a transaction. If the server crashes between "row created" and "counter bumped" a count can drift by 1 (a reconcile script could fix that; not needed for v1).
- Deleting a post also deletes the replies under it (other people's replies included).
- Search uses substring matching without a text index (works on any MongoDB, fine for v1 sizes). On large datasets add a MongoDB text index / Atlas Search; the service is the only place to change.
- Trending is computed in application code over the newest 5,000 posts that contain hashtags (identical behaviour on every MongoDB-compatible database). For big datasets switch to an aggregation pipeline or cached counters.
- Notifications are polled every 30 s, not pushed in real time. Suggested users are popularity-based (no "friends of friends" yet).
- `frontend/src/pages/ComingSoon.jsx` is no longer used by any route; you can delete it.
- If someone you follow reposts a post by another person you follow, you see both entries (no de-duplication yet).
- The "Following" timeline loads your follow list into one `$in` query, which is fine for normal accounts; accounts following tens of thousands of people would need a different approach.
- Existing accounts created earlier with a name that is now reserved (e.g. `post`) keep working but their profile URL would be ambiguous; unlikely, but worth knowing.
- Sessions are stateless JWTs: logout clears the cookie, but a copied token stays valid until it expires. A `tokenVersion`
  (revoke-all-sessions) can be added later if needed.
- No password reset / email verification (not in the spec).
- Right sidebar shows empty states until trends/suggestions exist.
- Test note: the sandbox database (FerretDB) loses concurrent `$inc` updates, which real MongoDB doesn't, so "many *different* users like at the same instant" was verified sequentially there. The same-user concurrency tests (unique-index based) did run concurrently. Please run `npm test` once on real MongoDB.
- Verification note: in the build sandbox the API, Vite proxy and cookie flow were exercised against a MongoDB-compatible
  server (FerretDB), not the official `mongod`. Please run the checklist above once on your machine with real MongoDB.
