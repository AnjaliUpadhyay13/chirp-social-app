import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import PostDetail from './pages/PostDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import Profile, { ProfileRedirect } from './pages/Profile.jsx';
import FollowList from './pages/FollowList.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public: only for logged-out users */}
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>
      </Route>

      {/* Private: requires a session */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="post/:id" element={<PostDetail />} />
          <Route path="explore" element={<ComingSoon title="Explore" phase={5} />} />
          <Route path="notifications" element={<ComingSoon title="Notifications" phase={5} />} />
          <Route path="bookmarks" element={<ComingSoon title="Bookmarks" phase={5} />} />
          <Route path="profile" element={<ProfileRedirect />} />
          <Route path=":username" element={<Profile />} />
          <Route path=":username/followers" element={<FollowList kind="followers" />} />
          <Route path=":username/following" element={<FollowList kind="following" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
