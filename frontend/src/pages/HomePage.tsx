import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import SearchInput from "../components/SearchInput";
import PostCard from "../components/PostCard";
import CreateArticleForm from "../components/CreateArticleForm";
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
}

const HomePage = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArticles = async () => {
    const res = await apiRequest<Article[]>("/api/articles");
    if (res.success && res.data) {
      setArticles(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleArticleCreated = (article: Article) => {
    setArticles((prev) => [article, ...prev]);
  };

  return (
    <div className="gap-4 flex flex-col justify-center items-center">
      <SearchInput />

      <CreateArticleForm onCreated={handleArticleCreated} />

      {loading ? (
        <span className="text-gray-400 text-lg py-10">Loading posts...</span>
      ) : articles.length === 0 ? (
        <span className="text-gray-400 text-lg py-10">No posts yet.</span>
      ) : (
        articles.map((article) => (
          <PostCard
            key={article.id}
            id={article.id}
            title={article.title}
            authorName={article.name || article.email}
            avatarUrl={article.avatar_url}
            body={article.body}
            imageUrl={article.image_url}
            createdAt={article.created_at}
          />
        ))
      )}

      <Menu />
    </div>
  );
};

export default HomePage;
