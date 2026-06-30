import { useState } from "react";
import { apiRequest } from "../api/client";
import type { Article } from "../types/article";
import "../CSS/PostCard.css";

interface CreateArticleFormProps {
  onCreated: (article: Article) => void;
}

const CreateArticleForm = ({ onCreated }: CreateArticleFormProps) => {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Publishing: create a new article via the API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: Record<string, string> = { title, body };
    if (imageUrl.trim()) {
      payload.image_url = imageUrl.trim();
    }

    const res = await apiRequest<Article>("/api/articles", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (res.success && res.data) {
      onCreated(res.data);
      setTitle("");
      setBody("");
      setImageUrl("");
      setExpanded(false);
    } else {
      setError(res.error || "Failed to create article.");
    }
  };

  if (!expanded) {
    return (
      <div
        className="form cursor-pointer flex items-center gap-3 px-4 py-3"
        onClick={() => setExpanded(true)}
      >
        <img className="plus" src="/plus.svg" alt="new" style={{ width: 22, height: 22 }} />
        <span className="text-gray-400">Create a new post...</span>
      </div>
    );
  }

  return (
    <form className="form flex flex-col gap-3 p-4" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-cyan-400 outline-none"
        required
      />
      <textarea
        placeholder="Write your post..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full bg-transparent border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-cyan-400 outline-none resize-none"
        required
      />
      <input
        type="url"
        placeholder="Image URL (optional)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        className="w-full bg-transparent border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-cyan-400 outline-none"
      />

      {error && <span className="text-red-400 text-sm">{error}</span>}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setError(null);
          }}
          className="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim() || !body.trim()}
          className="px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Publishing..." : "Publish"}
        </button>
      </div>
    </form>
  );
};

export default CreateArticleForm;
