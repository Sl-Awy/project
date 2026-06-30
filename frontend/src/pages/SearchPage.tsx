import { useEffect, useState, type FormEvent } from "react";
import Menu from "../components/Menu";
import SearchInput from "../components/SearchInput";
import { useAuth } from "../context/AuthContext";
import { searchUsers, followUser, type SearchUser } from "../api/users";
import { getMessages, sendMessage, type MessageRow } from "../api/messenger";
import { resolveMediaUrl } from "../utils/mediaUrl";

function displayName(name: string | null, userId: number): string {
  if (name && name.trim()) return name.trim();
  return `User #${userId}`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const SearchPage = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [peer, setPeer] = useState<SearchUser | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debouncedQ.length < 1) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await searchUsers(debouncedQ);
      if (cancelled) return;
      setLoading(false);
      setSearched(true);
      setResults(res.success && res.data ? res.data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  const openChat = async (u: SearchUser) => {
    setPeer(u);
    setDraft("");
    setError(null);
    setMessages([]);
    // Only an existing relationship has a thread worth loading.
    if (u.is_following || u.follows_you) {
      setMsgLoading(true);
      const res = await getMessages(u.id);
      setMsgLoading(false);
      if (res.success && res.data) setMessages(res.data);
    }
  };

  const closeChat = () => {
    setPeer(null);
    setMessages([]);
    setDraft("");
    setError(null);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!peer || !user || sending) return;
    const text = draft.trim();
    if (!text) return;

    setError(null);
    setSending(true);

    // Direct messages require a follow relationship on the backend, so connect
    // first when reaching out to someone new from search.
    let target = peer;
    if (!target.is_following) {
      const followRes = await followUser(target.id);
      if (!followRes.success) {
        setSending(false);
        setError(followRes.error || "Could not start this conversation.");
        return;
      }
      target = { ...target, is_following: true };
      setPeer(target);
      setResults((prev) =>
        prev.map((r) => (r.id === target.id ? { ...r, is_following: true } : r))
      );
    }

    const res = await sendMessage(target.id, text);
    setSending(false);
    if (res.success && res.data) {
      setDraft("");
      setMessages((prev) => [...prev, res.data!]);
    } else {
      setError(res.error || "Could not send your message.");
    }
  };

  const peerName = peer ? displayName(peer.name, peer.id) : "";
  const peerAvatar = peer ? resolveMediaUrl(peer.avatar_url) : null;

  return (
    <div className="mt-10 gap-4 flex flex-col items-center w-full max-w-3xl mx-auto px-4 pb-28">
      <h1 className="font-bold text-3xl text-gray-50">Friends</h1>
      <p className="text-gray-400 text-sm text-center max-w-xl">
        Find anyone by their username or user ID, then send them a private message.
      </p>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by username or ID…"
      />

      <div className="w-full max-w-3xl px-5">
        {debouncedQ.length < 1 ? (
          <p className="text-gray-500 text-sm">Start typing a username or a user ID to find people.</p>
        ) : loading ? (
          <p className="text-gray-500 text-sm">Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {searched ? `No one found matching “${debouncedQ}”.` : "Searching…"}
          </p>
        ) : (
          <ul className="space-y-2">
            {results.map((u) => {
              const avatar = resolveMediaUrl(u.avatar_url);
              return (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {avatar ? (
                      <img src={avatar} alt="" className="rounded-full w-10 h-10 object-cover shrink-0" />
                    ) : (
                      <div className="rounded-full bg-teal-700 w-10 h-10 flex items-center justify-center text-white font-bold shrink-0">
                        {displayName(u.name, u.id).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-100 truncate">{displayName(u.name, u.id)}</div>
                      <div className="text-xs text-gray-500">
                        ID #{u.id}
                        {u.follows_you ? " · follows you" : ""}
                        {u.is_following ? " · following" : ""}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openChat(u)}
                    className="shrink-0 px-3 py-1 rounded text-sm font-medium bg-cyan-600 text-gray-900 hover:bg-cyan-500"
                  >
                    Message
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {peer && (
        <div className="w-full max-w-3xl px-5">
          <div className="flex flex-col border border-gray-700 rounded-lg overflow-hidden bg-gray-900/30 min-h-[280px]">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {peerAvatar ? (
                  <img src={peerAvatar} alt="" className="rounded-full w-8 h-8 object-cover shrink-0" />
                ) : (
                  <div className="rounded-full bg-teal-700 w-8 h-8 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {peerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-semibold text-gray-100 truncate">{peerName}</span>
              </div>
              <button
                type="button"
                onClick={closeChat}
                className="shrink-0 text-gray-400 hover:text-gray-200 text-sm"
                aria-label="Close conversation"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[280px]">
              {msgLoading ? (
                <p className="text-gray-500 text-sm">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-gray-500 text-sm">No messages yet. Say hello.</p>
              ) : (
                messages.map((m) => {
                  const mine = user && m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          mine ? "bg-cyan-700 text-gray-950" : "bg-gray-700 text-gray-100"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${mine ? "text-gray-900/70" : "text-gray-400"}`}>
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {error && (
              <p className="text-red-400 text-xs px-3" role="alert">
                {error}
              </p>
            )}

            <form onSubmit={handleSend} className="p-2 border-t border-gray-700 flex gap-2">
              <input
                type="text"
                className="flex-1 rounded bg-gray-800 border border-gray-600 px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-cyan-500"
                placeholder={`Message ${peerName}…`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="px-4 py-2 rounded bg-cyan-600 text-gray-900 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-500"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      )}

      <Menu />
    </div>
  );
};

export default SearchPage;
