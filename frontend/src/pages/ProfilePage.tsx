import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { removeAvatar, updateNickname, uploadAvatar } from "../api/profile";
import { useAuth } from "../context/AuthContext";
import PostCard from "../components/PostCard";
import Menu from "../components/Menu";
import type { Article } from "../types/article";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { validateAvatarFile, validateNicknameInput } from "../utils/nickname";

interface PaginatedResponse {
  articles: Article[];
  page: number;
  total_pages: number;
  total: number;
}

const AVATAR_COLORS = [
  "bg-red-700",
  "bg-blue-700",
  "bg-green-700",
  "bg-purple-700",
  "bg-orange-600",
  "bg-pink-700",
  "bg-teal-700",
  "bg-indigo-700",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [nicknameDraft, setNicknameDraft] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);
  const [savingNickname, setSavingNickname] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const displayName =
    user?.name && user.name.trim() ? user.name.trim() : user?.email || "User";
  const initial = displayName.charAt(0).toUpperCase();
  const bgColor = getAvatarColor(displayName);
  const avatarSrc = resolveMediaUrl(user?.avatar_url ?? null);

  useEffect(() => {
    if (user) {
      setNicknameDraft(user.name ?? "");
    }
  }, [user?.name, user?.id]);

  // Profile feed: articles authored by this user
  const fetchArticles = async (p: number) => {
    if (!user) return;
    setLoading(true);
    const res = await apiRequest<PaginatedResponse>(
      `/api/articles?user_id=${user.id}&page=${p}`
    );
    if (res.success && res.data) {
      setArticles(res.data.articles);
      setPage(res.data.page);
      setTotalPages(res.data.total_pages);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchArticles(1);
  }, [user]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    fetchArticles(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleArticleDeleted = (id: number) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  };

  const pageNumbers = () => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  };

  const handleSaveNickname = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileOk(null);
    const err = validateNicknameInput(nicknameDraft);
    if (err) {
      setProfileError(err);
      return;
    }
    setSavingNickname(true);
    const res = await updateNickname(nicknameDraft.trim());
    setSavingNickname(false);
    if (res.success && res.data?.user) {
      updateUser(res.data.user);
      setProfileOk("Nickname saved.");
    } else {
      setProfileError(res.error || "Could not save nickname.");
    }
  };

  const handleAvatarPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProfileError(null);
    setProfileOk(null);
    const v = validateAvatarFile(file);
    if (v) {
      setProfileError(v);
      return;
    }
    setUploadingAvatar(true);
    const res = await uploadAvatar(file);
    setUploadingAvatar(false);
    if (res.success && res.data?.user) {
      updateUser(res.data.user);
      setProfileOk("Avatar updated.");
    } else {
      setProfileError(res.error || "Could not upload avatar.");
    }
  };

  const handleRemoveAvatar = async () => {
    setProfileError(null);
    setProfileOk(null);
    setRemovingAvatar(true);
    const res = await removeAvatar();
    setRemovingAvatar(false);
    if (res.success && res.data?.user) {
      updateUser(res.data.user);
      setProfileOk("Avatar removed.");
    } else {
      setProfileError(res.error || "Could not remove avatar.");
    }
  };

  return (
    <div className="mt-10 gap-4 flex flex-col justify-center items-center px-4 pb-28">
      <h1 className="text-4xl font-bold text-gray-50">Profile</h1>

      <div className="forms1 max-w-3xl w-full shadow-lg rounded-lg p-6">
        <div className="flex flex-col items-center gap-4">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={displayName}
              className="rounded-full w-20 h-20 object-cover"
            />
          ) : (
            <div
              className={`rounded-full ${bgColor} w-20 h-20 flex justify-center items-center text-white text-3xl font-bold`}
            >
              {initial}
            </div>
          )}

          <div className="text-center w-full">
            <h4 className="font-semibold text-xl text-gray-100">{displayName}</h4>
            <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/tasks")}
            className="w-full max-w-md px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
          >
            View my tasks
          </button>

          {(profileError || profileOk) && (
            <p
              className={`text-sm w-full text-center ${profileError ? "text-red-400" : "text-cyan-400"}`}
              role="alert"
            >
              {profileError || profileOk}
            </p>
          )}

          {/* Profile: nickname and avatar (stored on the server) */}
          <div className="w-full max-w-md flex flex-col gap-4 border-t border-gray-700 pt-4">
            <form onSubmit={handleSaveNickname} className="flex flex-col gap-2">
              <label htmlFor="nickname" className="text-sm text-gray-400">
                Nickname
              </label>
              <input
                id="nickname"
                type="text"
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                placeholder="Your public name"
                autoComplete="nickname"
                className="w-full bg-transparent border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-cyan-400 outline-none"
              />
              <p className="text-xs text-gray-500">
                Letters, numbers, spaces, underscore (_), hyphen (-), em dash (—). Leave empty to clear.
              </p>
              <button
                type="submit"
                disabled={savingNickname}
                className="self-start px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 disabled:opacity-50 transition-colors"
              >
                {savingNickname ? "Saving…" : "Save nickname"}
              </button>
            </form>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-400">Avatar</span>
              <p className="text-xs text-gray-500">
                JPEG, PNG, GIF, or WebP from your device (max 2 MB). Shown at the same size as before (circle,
                cropped).
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200 hover:border-cyan-400 cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={handleAvatarPick}
                  />
                  {uploadingAvatar ? "Uploading…" : "Choose image"}
                </label>
                {user?.avatar_url && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={removingAvatar}
                    className="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 disabled:opacity-50 transition-colors"
                  >
                    {removingAvatar ? "Removing…" : "Remove photo"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-300 self-center mt-4">My Posts</h2>

      {loading ? (
        <span className="text-gray-400 text-lg py-10">Loading posts...</span>
      ) : articles.length === 0 ? (
        <span className="text-gray-400 text-lg py-10">No posts yet.</span>
      ) : (
        <>
          {articles.map((article) => (
            <PostCard
              key={article.id}
              id={article.id}
              title={article.title}
              authorName={article.name || article.email}
              authorId={article.user_id}
              avatarUrl={article.avatar_url}
              body={article.body}
              imageUrl={article.image_url}
              createdAt={article.created_at}
              likeCount={article.like_count}
              commentCount={article.comment_count}
              liked={article.user_has_liked}
              onDelete={handleArticleDeleted}
            />
          ))}

          {totalPages > 1 && (
            <div className="flex items-center gap-2 py-4">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              {pageNumbers().map((p) => (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-cyan-500 text-black"
                      : "border border-gray-600 text-gray-400 hover:text-white hover:border-cyan-400"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <Menu />
    </div>
  );
};

export default ProfilePage;
