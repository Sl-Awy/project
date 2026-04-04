import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import PostCard from "../components/PostCard";
import Menu from "../components/Menu";

interface Article {
  id: number;
  title: string;
  body: string;
  image_url: string | null;
  created_at: string;
  user_id: number;
  name: string | null;
  email: string;
  avatar_url: string | null;
  like_count: number;
  comment_count: number;
  user_has_liked: boolean;
}

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
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const displayName = user?.name || user?.email || "User";
  const initial = displayName.charAt(0).toUpperCase();
  const bgColor = getAvatarColor(displayName);

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

  return (
    <div className="mt-10 gap-4 flex flex-col justify-center items-center px-4 pb-28">
      <h1 className="text-4xl font-bold text-gray-50">Profile</h1>

      <div className="forms1 max-w-3xl w-full shadow-lg rounded-lg p-6">
        <div className="flex flex-col items-center gap-3">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
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
          <h4 className="font-semibold text-xl text-gray-100">{displayName}</h4>
          <p className="text-gray-500">{user?.email}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-300 self-center mt-4">
        My Posts
      </h2>

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
