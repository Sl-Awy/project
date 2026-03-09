import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import "../CSS/PostCard.css";

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      const res = await apiRequest<Article>(`/api/articles/${id}`);
      if (res.success && res.data) {
        setArticle(res.data);
      } else {
        setError(res.error || "Article not found.");
      }
      setLoading(false);
    };
    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span className="text-gray-400 text-lg">Loading article...</span>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <span className="text-red-400 text-lg">{error}</span>
        <Link to="/" className="text-cyan-400 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const authorName = article.name || article.email;
  const initial = authorName.charAt(0).toUpperCase();
  const bgColor = getAvatarColor(authorName);

  return (
    <div className="flex justify-center py-8 px-4">
      <div className="form" style={{ maxWidth: 700 }}>
        <Link to="/" className="text-cyan-400 hover:underline text-sm mb-4 inline-block">
          &larr; Back to home
        </Link>

        <h1 className="text-2xl font-bold text-white mb-4">{article.title}</h1>

        <div className="flex h-16 gap-4 items-center mb-4">
          {article.avatar_url ? (
            <img
              src={article.avatar_url}
              alt={authorName}
              className="rounded-full w-10 h-10 object-cover"
            />
          ) : (
            <div
              className={`rounded-full ${bgColor} w-10 h-10 flex justify-center items-center text-white font-bold`}
            >
              {initial}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-bold text-white">{authorName}</span>
            <span className="text-gray-500 text-sm">{formatDate(article.created_at)}</span>
          </div>
        </div>

        {article.image_url && (
          <img
            className="rounded-md w-full mb-4"
            src={article.image_url}
            alt={article.title}
          />
        )}

        <div className="text whitespace-pre-wrap leading-relaxed">{article.body}</div>
      </div>
    </div>
  );
};

export default ArticlePage;
