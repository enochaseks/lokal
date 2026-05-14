import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Heart, Sparkles, ThumbsUp } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

type ReactionType = "helpful" | "interested" | "love_it";

type ReactionOption = {
  type: ReactionType;
  label: string;
  icon: ReactNode;
};

const reactionOptions: ReactionOption[] = [
  { type: "helpful", label: "Helpful", icon: <ThumbsUp className="h-3.5 w-3.5" /> },
  { type: "interested", label: "Interested", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { type: "love_it", label: "Love it", icon: <Heart className="h-3.5 w-3.5" /> },
];

export function PostReactions({ postId }: { postId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<ReactionType, number>>({
    helpful: 0,
    interested: 0,
    love_it: 0,
  });
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingReaction, setSavingReaction] = useState<ReactionType | null>(null);

  const loadReactions = async () => {
    setLoading(true);
    const supabaseAny: any = supabase;
    const { data, error } = await supabaseAny
      .from("store_post_reactions")
      .select("reaction_type, user_id")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      return;
    }

    const nextCounts: Record<ReactionType, number> = { helpful: 0, interested: 0, love_it: 0 };
    let nextMyReaction: ReactionType | null = null;

    const rows: any[] = data ?? [];
    for (const row of rows) {
      const reaction = row.reaction_type as ReactionType;
      if (reaction in nextCounts) {
        nextCounts[reaction] += 1;
      }
      if (user?.id && row.user_id === user.id) {
        nextMyReaction = reaction;
      }
    }

    setCounts(nextCounts);
    setMyReaction(nextMyReaction);
    setLoading(false);
  };

  useEffect(() => {
    void loadReactions();
  }, [postId, user?.id]);

  const handleReact = async (reaction: ReactionType) => {
    if (!user) {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : "/";
      navigate({ to: "/auth", search: { redirect: redirectTo } });
      return;
    }

    setSavingReaction(reaction);
    try {
      const supabaseAny: any = supabase;
      if (myReaction === reaction) {
        const { error } = await supabaseAny
          .from("store_post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        if (error) throw error;
        setMyReaction(null);
      } else {
        const { error } = await supabaseAny.from("store_post_reactions").upsert(
          {
            post_id: postId,
            user_id: user.id,
            reaction_type: reaction,
          },
          { onConflict: "post_id,user_id" },
        );
        if (error) throw error;
        setMyReaction(reaction);
      }

      const nextCounts: Record<ReactionType, number> = { ...counts };
      if (myReaction === reaction) {
        nextCounts[reaction] = Math.max(0, nextCounts[reaction] - 1);
      } else {
        if (myReaction) nextCounts[myReaction] = Math.max(0, nextCounts[myReaction] - 1);
        nextCounts[reaction] += 1;
      }
      setCounts(nextCounts);
      toast.success("Reaction saved");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save reaction");
      void loadReactions();
    } finally {
      setSavingReaction(null);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {reactionOptions.map((option) => {
        const active = myReaction === option.type;
        const count = counts[option.type];
        return (
          <button
            key={option.type}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleReact(option.type);
            }}
            disabled={savingReaction !== null && savingReaction !== option.type}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            } ${loading ? "opacity-80" : ""}`}
            aria-pressed={active}
          >
            {option.icon}
            <span>{option.label}</span>
            {count > 0 && <span className="text-[10px] font-bold">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
