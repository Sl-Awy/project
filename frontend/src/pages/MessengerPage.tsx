import { useCallback, useEffect, useState, FormEvent } from "react";
import Menu from "../components/Menu";
import SearchInput from "../components/SearchInput";
import { useAuth } from "../context/AuthContext";
import { getConversations, getMessages, sendMessage, type Conversation, type MessageRow } from "../api/messenger";
import { searchUsers, followUser, unfollowUser, type SearchUser } from "../api/users";
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

const MessengerPage = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);

  const [peerId, setPeerId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    const res = await getConversations();
    if (res.success && res.data) {
      setConversations(res.data);
    }
    setConvLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debouncedQ.length < 1) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    (async () => {
      const res = await searchUsers(debouncedQ);
      if (!cancelled) {
        setSearchLoading(false);
        if (res.success && res.data) setSearchResults(res.data);
        else setSearchResults([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  const openThread = async (id: number) => {
    setPeerId(id);
    setSendError(null);
    setMsgLoading(true);
    const res = await getMessages(id);
    setMsgLoading(false);
    if (res.success && res.data) {
      setMessages(res.data);
    } else {
      setMessages([]);
      setSendError(res.error || "Could not load messages.");
    }
  };

  const handleFollowToggle = async (u: SearchUser) => {
    setActionError(null);
    if (u.is_following) {
      const res = await unfollowUser(u.id);
      if (!res.success) {
        setActionError(res.error || "Unfollow failed.");
        return;
      }
      setSearchResults((prev) =>
        prev.map((row) => (row.id === u.id ? { ...row, is_following: false } : row))
      );
      if (peerId === u.id) {
        setPeerId(null);
        setMessages([]);
      }
      loadConversations();
    } else {
      const res = await followUser(u.id);
      if (!res.success) {
        setActionError(res.error || "Follow failed.");
        return;
      }
      setSearchResults((prev) =>
        prev.map((row) => (row.id === u.id ? { ...row, is_following: true } : row))
      );
      loadConversations();
    }
  };

  // Messenger: send a direct message to the selected peer
  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!peerId || !draft.trim() || !user) return;
    setSendError(null);
    const res = await sendMessage(peerId, draft.trim());
    if (res.success && res.data) {
      setDraft("");
      setMessages((prev) => [...prev, res.data]);
      loadConversations();
    } else {
      setSendError(res.error || "Could not send.");
    }
  };

  const selectedPeerName =
    peerId === null
      ? null
      : displayName(
          conversations.find((c) => c.id === peerId)?.name ??
            searchResults.find((s) => s.id === peerId)?.name ??
            null,
          peerId
        );

  const followingSelected =
    peerId !== null &&
    (conversations.some((c) => c.id === peerId) ||
      searchResults.some((s) => s.id === peerId && s.is_following));

  return (
    <div className="mt-10 gap-4 flex flex-col items-center w-full max-w-4xl mx-auto px-4 pb-28">
      <h1 className="font-bold text-3xl text-gray-50 self-center">Messenger</h1>
      <p className="text-gray-400 text-sm text-center max-w-xl">
        Follow someone to send them a private message. Search for users by name or email.
      </p>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search people…"
      />

      {actionError && (
        <p className="text-red-400 text-sm w-full max-w-3xl px-5" role="alert">
          {actionError}
        </p>
      )}

      {debouncedQ.length >= 1 && (
        <div className="w-full max-w-3xl px-5 space-y-2">
          <h2 className="text-gray-400 text-sm font-semibold uppercase tracking-wide">Search results</h2>
          {searchLoading ? (
            <p className="text-gray-500 text-sm">Searching…</p>
          ) : searchResults.length === 0 ? (
            <p className="text-gray-500 text-sm">No users found.</p>
          ) : (
            <ul className="space-y-2">
              {searchResults.map((u) => {
                const peerAvatar = resolveMediaUrl(u.avatar_url);
                return (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2"
                >
                  <button
                    type="button"
                    className="flex items-center gap-3 min-w-0 text-left flex-1 bg-transparent border-none cursor-pointer p-0"
                    onClick={() => {
                      if (u.is_following) openThread(u.id);
                    }}
                    disabled={!u.is_following}
                  >
                    {peerAvatar ? (
                      <img
                        src={peerAvatar}
                        alt=""
                        className="rounded-full w-10 h-10 object-cover shrink-0"
                      />
                    ) : (
                      <div className="rounded-full bg-teal-700 w-10 h-10 flex items-center justify-center text-white font-bold shrink-0">
                        {displayName(u.name, u.id).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-100 truncate">{displayName(u.name, u.id)}</div>
                      <div className="text-xs text-gray-500">
                        {u.follows_you && u.is_following
                          ? "You follow each other"
                          : u.follows_you
                            ? "Follows you"
                            : u.is_following
                              ? "Following · tap to open chat"
                              : "Follow to message"}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFollowToggle(u)}
                    className={`shrink-0 px-3 py-1 rounded text-sm font-medium ${
                      u.is_following
                        ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                        : "bg-cyan-600 text-gray-900 hover:bg-cyan-500"
                    }`}
                  >
                    {u.is_following ? "Unfollow" : "Follow"}
                  </button>
                </li>
              );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="w-full max-w-3xl flex flex-col md:flex-row gap-4 mt-4">
        <div className="md:w-2/5 flex flex-col border border-gray-700 rounded-lg overflow-hidden bg-gray-900/30 min-h-[280px]">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wide px-3 py-2 border-b border-gray-700">
            People you follow
          </h2>
          {convLoading ? (
            <p className="text-gray-500 text-sm p-3">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="text-gray-500 text-sm p-3">Follow someone to start messaging.</p>
          ) : (
            <ul className="overflow-y-auto max-h-[360px]">
              {conversations.map((c) => {
                const convAvatar = resolveMediaUrl(c.avatar_url);
                return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openThread(c.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left border-b border-gray-800 hover:bg-gray-800/50 ${
                      peerId === c.id ? "bg-gray-800/70" : ""
                    }`}
                  >
                    {convAvatar ? (
                      <img
                        src={convAvatar}
                        alt=""
                        className="rounded-full w-10 h-10 object-cover shrink-0"
                      />
                    ) : (
                      <div className="rounded-full bg-indigo-700 w-10 h-10 flex items-center justify-center text-white font-bold shrink-0">
                        {displayName(c.name, c.id).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-100 truncate">{displayName(c.name, c.id)}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {c.last_message_body || "No messages yet"}
                      </div>
                    </div>
                    {c.last_message_at && (
                      <span className="text-xs text-cyan-500/80 shrink-0">{formatTime(c.last_message_at)}</span>
                    )}
                  </button>
                </li>
              );
              })}
            </ul>
          )}
        </div>

        <div className="md:flex-1 flex flex-col border border-gray-700 rounded-lg overflow-hidden bg-gray-900/30 min-h-[280px]">
          {peerId === null ? (
            <div className="flex-1 flex items-center justify-center p-6 text-gray-500 text-sm text-center">
              Select a conversation or follow someone from search, then open the chat.
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="font-semibold text-gray-100">{selectedPeerName}</span>
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
              {sendError && (
                <p className="text-red-400 text-xs px-3" role="alert">
                  {sendError}
                </p>
              )}
              <form onSubmit={handleSend} className="p-2 border-t border-gray-700 flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded bg-gray-800 border border-gray-600 px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-cyan-500"
                  placeholder={followingSelected ? "Message…" : "Follow this user to send messages"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!followingSelected}
                />
                <button
                  type="submit"
                  disabled={!followingSelected || !draft.trim()}
                  className="px-4 py-2 rounded bg-cyan-600 text-gray-900 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-500"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <Menu />
    </div>
  );
};

export default MessengerPage;
