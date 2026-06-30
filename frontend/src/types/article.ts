/** Article as returned by the articles list/detail API (includes author + engagement). */
export interface Article {
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
