"use client";

import { Search, SmilePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PREMIUM_PANEL, PREMIUM_TOOL_CHIP } from "@/components/ui/premium-styles";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";

type EmojiEntry = {
  symbol: string;
  label: string;
  keywords: string[];
};

type EmojiCategory = {
  key: string;
  label: string;
  icon: string;
  emojis: EmojiEntry[];
};

const RECENT_STORAGE_KEY = "evyta-recent-emojis";

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: "smileys",
    label: "Smileys",
    icon: "😊",
    emojis: [
      { symbol: "😀", label: "grinning face", keywords: ["happy", "smile"] },
      { symbol: "🙂", label: "slight smile", keywords: ["happy", "warm"] },
      { symbol: "😊", label: "smiling face", keywords: ["smile", "soft"] },
      { symbol: "😉", label: "wink", keywords: ["wink", "flirt"] },
      { symbol: "😍", label: "heart eyes", keywords: ["love", "adore"] },
      { symbol: "🥰", label: "smiling hearts", keywords: ["love", "care"] },
      { symbol: "😘", label: "kiss", keywords: ["kiss", "affection"] },
      { symbol: "😌", label: "relieved", keywords: ["calm", "soft"] },
      { symbol: "🤗", label: "hug", keywords: ["hug", "warm"] },
      { symbol: "🫠", label: "melting", keywords: ["soft", "playful"] },
      { symbol: "🤍", label: "white heart", keywords: ["love", "heart"] },
      { symbol: "🖤", label: "black heart", keywords: ["heart", "moody"] },
    ],
  },
  {
    key: "hearts",
    label: "Hearts",
    icon: "❤️",
    emojis: [
      { symbol: "❤️", label: "red heart", keywords: ["love", "heart"] },
      { symbol: "🩷", label: "pink heart", keywords: ["love", "heart"] },
      { symbol: "🧡", label: "orange heart", keywords: ["heart", "warm"] },
      { symbol: "💛", label: "yellow heart", keywords: ["heart", "sunny"] },
      { symbol: "💚", label: "green heart", keywords: ["heart", "calm"] },
      { symbol: "🩵", label: "light blue heart", keywords: ["heart", "gentle"] },
      { symbol: "💜", label: "purple heart", keywords: ["heart", "plum"] },
      { symbol: "🤎", label: "brown heart", keywords: ["heart", "grounded"] },
      { symbol: "💞", label: "revolving hearts", keywords: ["love", "heart"] },
      { symbol: "💓", label: "beating heart", keywords: ["heart", "love"] },
      { symbol: "💗", label: "growing heart", keywords: ["heart", "romance"] },
      { symbol: "💖", label: "sparkling heart", keywords: ["heart", "sparkle"] },
    ],
  },
  {
    key: "gestures",
    label: "Gestures",
    icon: "🙌",
    emojis: [
      { symbol: "👋", label: "wave", keywords: ["hello", "wave"] },
      { symbol: "🫶", label: "heart hands", keywords: ["love", "care"] },
      { symbol: "🙏", label: "thanks", keywords: ["please", "thanks"] },
      { symbol: "🙌", label: "celebrate", keywords: ["yay", "celebrate"] },
      { symbol: "👏", label: "clap", keywords: ["clap", "support"] },
      { symbol: "🤝", label: "handshake", keywords: ["trust", "deal"] },
      { symbol: "👍", label: "thumbs up", keywords: ["yes", "approve"] },
      { symbol: "👌", label: "ok hand", keywords: ["ok", "agree"] },
      { symbol: "💅", label: "nail polish", keywords: ["style", "confidence"] },
      { symbol: "🤍", label: "white heart", keywords: ["care", "heart"] },
    ],
  },
  {
    key: "people",
    label: "People",
    icon: "🫂",
    emojis: [
      { symbol: "💃", label: "dance", keywords: ["dance", "joy"] },
      { symbol: "🕺", label: "dancing man", keywords: ["dance", "fun"] },
      { symbol: "👩‍❤️‍💋‍👨", label: "kiss couple", keywords: ["kiss", "couple"] },
      { symbol: "👩‍❤️‍👩", label: "women couple", keywords: ["love", "couple"] },
      { symbol: "👨‍❤️‍👨", label: "men couple", keywords: ["love", "couple"] },
      { symbol: "🫂", label: "people hugging", keywords: ["hug", "comfort"] },
      { symbol: "🧘", label: "meditation", keywords: ["calm", "balance"] },
      { symbol: "🕊️", label: "dove", keywords: ["peace", "quiet"] },
    ],
  },
  {
    key: "nature",
    label: "Nature",
    icon: "✨",
    emojis: [
      { symbol: "🌙", label: "moon", keywords: ["night", "moon"] },
      { symbol: "⭐", label: "star", keywords: ["night", "star"] },
      { symbol: "✨", label: "sparkles", keywords: ["sparkle", "glow"] },
      { symbol: "💫", label: "dizzy", keywords: ["sparkle", "magic"] },
      { symbol: "🌸", label: "blossom", keywords: ["flower", "soft"] },
      { symbol: "🌹", label: "rose", keywords: ["flower", "romance"] },
      { symbol: "🌿", label: "herb", keywords: ["green", "fresh"] },
      { symbol: "🍂", label: "leaf", keywords: ["autumn", "leaf"] },
      { symbol: "🌊", label: "wave", keywords: ["water", "sea"] },
      { symbol: "☀️", label: "sun", keywords: ["light", "sun"] },
      { symbol: "❄️", label: "snowflake", keywords: ["cold", "winter"] },
      { symbol: "🫧", label: "bubbles", keywords: ["soft", "air"] },
    ],
  },
  {
    key: "food",
    label: "Food",
    icon: "🥂",
    emojis: [
      { symbol: "☕", label: "coffee", keywords: ["coffee", "warm"] },
      { symbol: "🍷", label: "wine", keywords: ["wine", "evening"] },
      { symbol: "🥂", label: "toast", keywords: ["cheers", "drink"] },
      { symbol: "🍓", label: "strawberry", keywords: ["fruit", "sweet"] },
      { symbol: "🍒", label: "cherries", keywords: ["fruit", "sweet"] },
      { symbol: "🍫", label: "chocolate", keywords: ["sweet", "treat"] },
      { symbol: "🧁", label: "cupcake", keywords: ["dessert", "sweet"] },
      { symbol: "🍰", label: "cake", keywords: ["dessert", "celebrate"] },
    ],
  },
  {
    key: "travel",
    label: "Travel",
    icon: "✈️",
    emojis: [
      { symbol: "✈️", label: "airplane", keywords: ["travel", "flight"] },
      { symbol: "🚗", label: "car", keywords: ["travel", "drive"] },
      { symbol: "🛥️", label: "motor boat", keywords: ["boat", "sea"] },
      { symbol: "🏖️", label: "beach", keywords: ["beach", "vacation"] },
      { symbol: "🏙️", label: "cityscape", keywords: ["city", "night"] },
      { symbol: "🏡", label: "house", keywords: ["home", "cozy"] },
      { symbol: "🗺️", label: "map", keywords: ["travel", "map"] },
      { symbol: "🌆", label: "sunset city", keywords: ["sunset", "city"] },
    ],
  },
  {
    key: "activities",
    label: "Activities",
    icon: "🎉",
    emojis: [
      { symbol: "🎶", label: "music", keywords: ["music", "song"] },
      { symbol: "🎵", label: "musical note", keywords: ["music", "note"] },
      { symbol: "🎁", label: "gift", keywords: ["gift", "present"] },
      { symbol: "🎉", label: "party popper", keywords: ["party", "celebrate"] },
      { symbol: "🕯️", label: "candle", keywords: ["calm", "candle"] },
      { symbol: "📚", label: "books", keywords: ["read", "book"] },
      { symbol: "🎬", label: "movie", keywords: ["film", "movie"] },
      { symbol: "🧩", label: "puzzle", keywords: ["game", "puzzle"] },
    ],
  },
  {
    key: "objects",
    label: "Objects",
    icon: "💎",
    emojis: [
      { symbol: "📸", label: "camera", keywords: ["camera", "photo"] },
      { symbol: "📷", label: "camera flash", keywords: ["camera", "flash"] },
      { symbol: "💌", label: "love letter", keywords: ["letter", "message"] },
      { symbol: "💎", label: "gem", keywords: ["luxury", "gem"] },
      { symbol: "🪞", label: "mirror", keywords: ["beauty", "mirror"] },
      { symbol: "🛋️", label: "couch", keywords: ["home", "lounge"] },
      { symbol: "🕯️", label: "candle", keywords: ["warm", "glow"] },
      { symbol: "🔒", label: "lock", keywords: ["private", "safe"] },
      { symbol: "📍", label: "pin", keywords: ["location", "pin"] },
      { symbol: "📎", label: "paperclip", keywords: ["attach", "file"] },
    ],
  },
  {
    key: "symbols",
    label: "Symbols",
    icon: "💬",
    emojis: [
      { symbol: "💬", label: "speech balloon", keywords: ["chat", "talk"] },
      { symbol: "📣", label: "megaphone", keywords: ["share", "announce"] },
      { symbol: "🔔", label: "bell", keywords: ["notification", "alert"] },
      { symbol: "🔥", label: "fire", keywords: ["hot", "exciting"] },
      { symbol: "💯", label: "hundred", keywords: ["great", "perfect"] },
      { symbol: "✅", label: "check", keywords: ["done", "approved"] },
      { symbol: "❣️", label: "heart exclamation", keywords: ["heart", "attention"] },
      { symbol: "➕", label: "plus", keywords: ["add", "plus"] },
    ],
  },
];

function loadRecentEmojis() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const value = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveRecentEmoji(symbol: string) {
  if (typeof window === "undefined") {
    return;
  }

  const recent = loadRecentEmojis().filter((item) => item !== symbol);
  recent.unshift(symbol);
  window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent.slice(0, 20)));
}

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("recent");
  const [search, setSearch] = useState("");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setRecentEmojis(loadRecentEmojis());
    }
  }, [open]);

  useDismissibleLayer({
    open,
    onDismiss: () => setOpen(false),
    refs: [containerRef],
    restoreFocusRef: triggerRef,
  });

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open]);

  const allEmojiEntries = useMemo(() => EMOJI_CATEGORIES.flatMap((category) => category.emojis), []);

  const visibleEmojis = useMemo(() => {
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      return allEmojiEntries.filter((entry) =>
        entry.label.toLowerCase().includes(query) || entry.keywords.some((keyword) => keyword.includes(query)),
      );
    }

    if (activeCategory === "recent") {
      const recentMatches = recentEmojis
        .map((symbol) => allEmojiEntries.find((entry) => entry.symbol === symbol))
        .filter((entry): entry is EmojiEntry => Boolean(entry));

      return recentMatches.length > 0 ? recentMatches : EMOJI_CATEGORIES[0].emojis;
    }

    return EMOJI_CATEGORIES.find((category) => category.key === activeCategory)?.emojis ?? [];
  }, [activeCategory, allEmojiEntries, recentEmojis, search]);

  function handleSelect(symbol: string) {
    saveRecentEmoji(symbol);
    setRecentEmojis(loadRecentEmojis());
    onSelect(symbol);
    setOpen(false);
    setSearch("");
  }

  const showEmptySearchState = search.trim().length > 0 && visibleEmojis.length === 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        className={PREMIUM_TOOL_CHIP}
        ref={triggerRef}
        onClick={() => setOpen((value) => !value)}
        title="Insert emoji"
        type="button"
      >
        <SmilePlus className="h-4 w-4" />
      </button>

      {open ? (
        <div className={`absolute left-0 top-11 z-30 w-[21rem] p-2.5 ${PREMIUM_PANEL}`} data-testid="emoji-picker-panel">
          <div className="flex items-center gap-2 rounded-[0.95rem] border border-[rgba(228,213,192,0.06)] bg-[rgba(32,25,21,0.42)] px-3 py-2">
            <Search className="h-4 w-4 text-white/44" />
            <input
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/38"
              ref={searchInputRef}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search emoji"
              value={search}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-0.5" data-testid="emoji-picker-tabs">
            <button
              aria-label="Recent emojis"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-[14px] transition duration-200 ${activeCategory === "recent" && !search ? "border-[rgba(189,151,100,0.16)] bg-[rgba(189,151,100,0.06)] text-[color:var(--lux-text-accent)]" : "border-[rgba(228,213,192,0.05)] bg-[rgba(255,255,255,0.018)] text-white/56 hover:border-[rgba(228,213,192,0.1)] hover:bg-[rgba(255,255,255,0.035)]"}`}
              onClick={() => setActiveCategory("recent")}
              type="button"
            >
              <span aria-hidden="true">🕘</span>
            </button>
            {EMOJI_CATEGORIES.map((category) => (
              <button
                aria-label={category.label}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-[14px] transition duration-200 ${activeCategory === category.key && !search ? "border-[rgba(189,151,100,0.16)] bg-[rgba(189,151,100,0.06)] text-[color:var(--lux-text-accent)]" : "border-[rgba(228,213,192,0.05)] bg-[rgba(255,255,255,0.018)] text-white/56 hover:border-[rgba(228,213,192,0.1)] hover:bg-[rgba(255,255,255,0.035)]"}`}
                key={category.key}
                onClick={() => setActiveCategory(category.key)}
                type="button"
              >
                <span aria-hidden="true">{category.icon}</span>
              </button>
            ))}
          </div>

          <div className="mt-2 grid max-h-72 grid-cols-8 gap-[2px] overflow-y-auto pr-1" data-testid="emoji-picker-grid">
            {showEmptySearchState ? (
              <p className="col-span-8 py-4 text-center text-sm text-white/54">No emoji found.</p>
            ) : (
              visibleEmojis.map((entry) => (
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[0.85rem] border border-[rgba(228,213,192,0.05)] bg-[rgba(255,255,255,0.022)] text-xl transition duration-200 hover:border-[rgba(189,151,100,0.12)] hover:bg-[rgba(189,151,100,0.06)]"
                  key={`${entry.symbol}-${entry.label}`}
                  onClick={() => handleSelect(entry.symbol)}
                  title={entry.label}
                  type="button"
                >
                  {entry.symbol}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}



