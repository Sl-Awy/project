import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { resolveMediaUrl } from "../utils/mediaUrl";
import "../CSS/PostCard.css";

interface PostCardProps {
  id: number;
  title: string;
  authorName: string;
  authorId: number;
  avatarUrl?: string | null;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  onDelete?: (id: number) => void;
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

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHrs < 24) return `${diffHrs} ${diffHrs === 1 ? "hour" : "hours"} ago`;
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  return date.toLocaleDateString();
}

const PREVIEW_LENGTH = 200;

const PostCard = ({
  id, title, authorName, authorId, avatarUrl, body, imageUrl, createdAt,
  likeCount: initialLikeCount, commentCount, liked: initialLiked, onDelete,
}: PostCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initial = authorName.charAt(0).toUpperCase();
  const bgColor = getAvatarColor(authorName);
  const preview = body.length > PREVIEW_LENGTH ? body.slice(0, PREVIEW_LENGTH) + "..." : body;
  const avatarSrc = resolveMediaUrl(avatarUrl ?? null);

  const canDelete = user && (user.id === authorId || user.role === "admin");

  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Post owner (or admin) may delete the article
  const handleDelete = async () => {
    setDeleteLoading(true);
    const res = await apiRequest(`/api/articles/${id}`, { method: "DELETE" });
    if (res.success) {
      if (onDelete) {
        onDelete(id);
      } else {
        navigate("/");
      }
    }
    setDeleteLoading(false);
    setShowDeleteConfirm(false);
  };

  // Likes: toggle like for this article
  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  return (
    <div className="form">
      <div className="options">
        <div className="flex h-16 gap-4 items-center">
          {avatarSrc ? (
            <img
              src={avatarSrc}
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
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-cyan-500/90 font-medium tracking-wide">Post by</span>
            <span className="font-bold text-xl text-gray-50">{authorName}</span>
            <span className="text-gray-500 text-sm">{formatRelativeTime(createdAt)}</span>
          </div>
        </div>
        {canDelete && (
          <div className="relative">
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="bg-transparent border-none cursor-pointer p-1"
            >
              <img className="dots" src="/three-dots-vertical.svg" alt="menu" />
            </button>
            {showDeleteConfirm && (
              <div className="absolute right-0 top-8 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10 p-3 min-w-[180px]">
                <p className="text-gray-300 text-sm mb-2">Delete this post?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    {deleteLoading ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1 rounded bg-gray-600 text-white text-sm hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Link to={`/article/${id}`} className="block mt-2 mb-1">
        <h3 className="text-lg font-semibold text-cyan-400 hover:underline">{title}</h3>
      </Link>

      <p className="text">{preview}</p>

      {imageUrl && (
        <img className="rounded-md w-full mt-2" src={imageUrl} alt="post" />
      )}

      <div className="flex justify-between mt-2">
        <div className="flex gap-4 items-center h-10">
          <button
            onClick={handleLike}
            disabled={likeLoading}
            className="flex gap-2 items-center cursor-pointer bg-transparent border-none p-0"
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
          <Link to={`/article/${id}`} className="flex gap-2 items-center cursor-pointer no-underline">
            <img className="chat" src="/chat-fill.svg" alt="comment" />
            <span className="text-gray-50">{commentCount}</span>
          </Link>
        </div>
        <div className="flex gap-2 items-center cursor-pointer">
          <img className="share" src="/share-fill.svg" alt="share" />
          <span className="text-gray-50">0</span>
        </div>
      </div>
    </div>
  );
};

export default PostCard;
