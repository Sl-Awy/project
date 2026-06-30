import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import SearchInput from "../components/SearchInput";
import PostCard from "../components/PostCard";
import CreateArticleForm from "../components/CreateArticleForm";
import Menu from "../components/Menu";
import type { Article } from "../types/article";

interface PaginatedResponse {
  articles: Article[];
  page: number;
  total_pages: number;
  total: number;
}

const HomePage = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Feed: load paginated posts for the home timeline
  const fetchArticles = async (p: number) => {
    setLoading(true);
    const res = await apiRequest<PaginatedResponse>(`/api/articles?page=${p}`);
    if (res.success && res.data) {
      setArticles(res.data.articles);
      setPage(res.data.page);
      setTotalPages(res.data.total_pages);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchArticles(page);
  }, []);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    fetchArticles(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleArticleCreated = () => {
    if (page === 1) {
      fetchArticles(1);
    } else {
      goToPage(1);
    }
  };

  const handleArticleDeleted = (id: number) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  };

  const pageNumbers = () => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="gap-4 flex flex-col justify-center items-center px-4 pb-28">
      <SearchInput />

      <CreateArticleForm onCreated={handleArticleCreated} />

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

export default HomePage;
