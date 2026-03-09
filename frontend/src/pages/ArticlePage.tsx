import { useEffect, useState, FormEvent } from "react";
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
  like_count: number;
  comment_count: number;
  user_has_liked: boolean;
}

interface Comment {
  id: number;
  body: string;
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

function Avatar({ name, avatarUrl, size = "w-10 h-10" }: { name: string; avatarUrl?: string | null; size?: string }) {
  const initial = name.charAt(0).toUpperCase();
  const bgColor = getAvatarColor(name);

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`rounded-full ${size} object-cover`} />;
  }
  return (
    <div className={`rounded-full ${bgColor} ${size} flex justify-center items-center text-white font-bold`}>
      {initial}
    </div>
  );
}

const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      const res = await apiRequest<Article>(`/api/articles/${id}`);
      if (res.success && res.data) {
        setArticle(res.data);
        setLiked(res.data.user_has_liked);
        setLikeCount(res.data.like_count);
      } else {
        setError(res.error || "Article not found.");
      }
      setLoading(false);
    };

    const fetchComments = async () => {
      const res = await apiRequest<Comment[]>(`/api/articles/${id}/comments`);
      if (res.success && res.data) {
        setComments(res.data);
      }
    };

    fetchArticle();
    fetchComments();
  }, [id]);

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setCommentLoading(true);
    setCommentError(null);

    const res = await apiRequest<Comment>(`/api/articles/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: commentText }),
    });

    if (res.success && res.data) {
      setComments((prev) => [...prev, res.data]);
      setCommentText("");
    } else {
      setCommentError(res.error || "Failed to post comment.");
    }
    setCommentLoading(false);
  };

  const handleLikeToggle = async () => {
    if (likeLoading) return;
    setLikeLoading(true);

    const res = await apiRequest<{ liked: boolean; like_count: number }>(
      `/api/articles/${id}/like`,
      { method: "POST" }
    );

    if (res.success && res.data) {
      setLiked(res.data.liked);
      setLikeCount(res.data.like_count);
    }
    setLikeLoading(false);
  };

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

  return (
    <div className="flex justify-center py-8 px-4">
      <div className="form" style={{ maxWidth: 700 }}>
        <Link to="/" className="text-cyan-400 hover:underline text-sm mb-4 inline-block">
          &larr; Back to home
        </Link>

        <h1 className="text-2xl font-bold text-white mb-4">{article.title}</h1>

        <div className="flex h-16 gap-4 items-center mb-4">
          <Avatar name={authorName} avatarUrl={article.avatar_url} />
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

        {/* Like button */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={handleLikeToggle}
            disabled={likeLoading}
            className="flex items-center gap-2 cursor-pointer transition-opacity disabled:opacity-50"
          >
            <img
              className="heart"
              src="/suit-heart-fill.svg"
              alt="like"
              style={liked ? { filter: "none" } : undefined}
            />
            <span className={liked ? "text-red-500 font-semibold" : "text-gray-50"}>
              {likeCount}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <img className="chat" src="/chat-fill.svg" alt="comments" />
            <span className="text-gray-50">{comments.length}</span>
          </div>
        </div>

        {/* Comments section */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Comments ({comments.length})
          </h2>

          {comments.length === 0 ? (
            <p className="text-gray-500 text-sm mb-4">No comments yet. Be the first!</p>
          ) : (
            <div className="flex flex-col gap-4 mb-6">
              {comments.map((c) => {
                const cName = c.name || c.email;
                return (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={cName} avatarUrl={c.avatar_url} size="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-white text-sm">{cName}</span>
                        <span className="text-gray-500 text-xs">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment form */}
          <form onSubmit={handleCommentSubmit} className="flex flex-col gap-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              className="w-full rounded-lg bg-gray-800 border border-gray-600 text-white px-3 py-2 text-sm resize-none focus:outline-none focus:border-cyan-400 placeholder-gray-500"
            />
            {commentError && (
              <span className="text-red-400 text-xs">{commentError}</span>
            )}
            <button
              type="submit"
              disabled={commentLoading || !commentText.trim()}
              className="self-end px-4 py-1.5 rounded-lg bg-cyan-500 text-black text-sm font-medium hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {commentLoading ? "Posting..." : "Post Comment"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ArticlePage;
