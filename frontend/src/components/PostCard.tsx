import { Link } from "react-router-dom";
import "../CSS/PostCard.css";

interface PostCardProps {
  id: number;
  title: string;
  authorName: string;
  avatarUrl?: string | null;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
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

const PostCard = ({ id, title, authorName, avatarUrl, body, imageUrl, createdAt }: PostCardProps) => {
  const initial = authorName.charAt(0).toUpperCase();
  const bgColor = getAvatarColor(authorName);
  const preview = body.length > PREVIEW_LENGTH ? body.slice(0, PREVIEW_LENGTH) + "..." : body;

  return (
    <div className="form">
      <div className="options">
        <div className="flex h-16 gap-4 items-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
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
            <span className="font-bold text-xl">{authorName}</span>
            <span className="text-gray-500">{formatRelativeTime(createdAt)}</span>
          </div>
        </div>
        <img className="dots" src="/three-dots-vertical.svg" alt="menu" />
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
          <div className="flex gap-2 items-center cursor-pointer">
            <img className="heart" src="/suit-heart-fill.svg" alt="like" />
            <span className="text-gray-50">0</span>
          </div>
          <div className="flex gap-2 items-center cursor-pointer">
            <img className="chat" src="/chat-fill.svg" alt="comment" />
            <span className="text-gray-50">0</span>
          </div>
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
