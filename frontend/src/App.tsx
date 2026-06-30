import { useEffect } from "react";
import { Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MessengerPage from "./pages/MessengerPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";
import SettingsPage from "./pages/SettingsPage";
import SignupPage from "./pages/SignupPage";
import ArticlePage from "./pages/ArticlePage";
import TasksPage from "./pages/TasksPage";

const PUBLIC_ROUTES = ["/login", "/signup"];

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Authentication: keep private routes behind login
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !PUBLIC_ROUTES.includes(location.pathname)) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate, location.pathname]);

  // Wait until /api/auth/me finishes so we do not flash protected pages while logged out
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-gray-400 text-lg">Loading...</span>
      </div>
    );
  }

  // Site map: one route per main screen (home, profile, messenger, etc.)
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/messenger" element={<MessengerPage />} />
      <Route path="/article/:id" element={<ArticlePage />} />
    </Routes>
  );
}

export default App;
