import { ConversationKind, ConversationStatus, MembershipStatus, PostContextType, PostVisibilityStatus, ReactionType } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getPromotedPlacement } from "@/lib/promotions";
import { SectionHeader } from "@/components/discovery/section-header";
import { EventFilterChips } from "@/components/events/event-filter-chips";
import { EventSignalCard } from "@/components/events/event-signal-card";
import { HomeBottomNav } from "@/components/home/bottom-nav";
import { HomeTopBar } from "@/components/home/top-bar";

type EventsTab = "all" | "tonight" | "upcoming" | "circle" | "private";

type EventSignal = {
  id: string;
  body: string;
  chips: string[];
  ctaHref: string;
  ctaLabel: string;
  emailVerified: boolean;
  goingCount: number;
  groupId?: string | null;
  interestedCount: number;
  overline: string;
  phoneVerified: boolean;
  postId?: string | null;
  privacyLabel: string;
  reactionType: "SUPPORT" | "CELEBRATE" | null;
  scopeLabel?: string | null;
  signals: string[];
  statusNote: string;
  timingBucket: "tonight" | "upcoming";
  timingLabel: string;
  title: string;
  trustTier: "LOW" | "NORMAL" | "HIGH" | null;
  circleCount: number;
  isPrivate: boolean;
};

function looksEventRelated(value: string) {
  return /event|tonight|tomorrow|join|going|party|gather|meet|dance|drinks|dinner|host/i.test(value);
}

function buildEventsQueryHref(tab: EventsTab, query: string) {
  const params = new URLSearchParams();
  if (tab !== "all") {
    params.set("tab", tab);
  }
  if (query) {
    params.set("query", query);
  }
  const suffix = params.toString();
  return suffix ? `/events?${suffix}` : "/events";
}

function deriveTimingLabel(contentText: string, createdAt: Date) {
  if (/tomorrow|next week|upcoming|later this week/i.test(contentText)) {
    return { bucket: "upcoming" as const, label: "Upcoming" };
  }
  if (/tonight|today|later/i.test(contentText)) {
    return { bucket: "tonight" as const, label: "Tonight" };
  }

  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  return ageHours <= 30 ? { bucket: "tonight" as const, label: "Tonight" } : { bucket: "upcoming" as const, label: "Upcoming" };
}

function trimTitle(contentText: string) {
  const compact = contentText.replace(/\s+/g, " ").trim();
  if (compact.length <= 58) {
    return compact;
  }
  return `${compact.slice(0, 55).trim()}...`;
}

function formatStartsAt(value: Date | null) {
  if (!value) {
    return { bucket: "upcoming" as const, label: "Soon" };
  }

  const now = new Date();
  const eventDay = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((eventDay - nowDay) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return { bucket: "tonight" as const, label: "Tonight" };
  }
  return { bucket: "upcoming" as const, label: diffDays === 1 ? "Tomorrow" : value.toLocaleString("en-US", { month: "short", day: "numeric" }) };
}

function emptyState(message: string) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-sm text-white/58">
      {message}
    </div>
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string; tab?: string }>;
}) {
  const viewer = await requireUser();
  const resolvedSearchParams = await searchParams;
  const query = (resolvedSearchParams?.query ?? "").trim();
  const requestedTab = (resolvedSearchParams?.tab ?? "all").toLowerCase();
  const activeTab: EventsTab = ["all", "tonight", "upcoming", "circle", "private"].includes(requestedTab)
    ? (requestedTab as EventsTab)
    : "all";

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: viewer.id, status: MembershipStatus.ACTIVE },
    select: { groupId: true },
  });
  const visibleGroupIds = memberships.map((membership) => membership.groupId);

  const [notificationCount, circleConversations, promotedPlacement, posts] = await Promise.all([
    prisma.notification.count({ where: { userId: viewer.id, readAt: null } }),
    prisma.conversation.findMany({
      where: {
        kind: ConversationKind.MEMBER_CHAT,
        status: ConversationStatus.ACTIVE,
        OR: [{ userOneId: viewer.id }, { userTwoId: viewer.id }],
      },
      select: { userOneId: true, userTwoId: true },
    }),
    getPromotedPlacement("HOME_FEED_CARD"),
    prisma.post.findMany({
      where: {
        visibilityStatus: PostVisibilityStatus.VISIBLE,
        OR: [
          { contextType: PostContextType.GLOBAL_FEED },
          { contextType: PostContextType.GROUP, groupId: { in: visibleGroupIds.length > 0 ? visibleGroupIds : ["__none__"] } },
        ],
        ...(query
          ? {
              OR: [
                { contentText: { contains: query, mode: "insensitive" } },
                { group: { name: { contains: query, mode: "insensitive" } } },
                { author: { displayName: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 16,
      select: {
        id: true,
        contentText: true,
        createdAt: true,
        authorUserId: true,
        contextType: true,
        groupId: true,
        author: {
          select: {
            id: true,
            displayName: true,
            trustTier: true,
            emailVerified: true,
            phoneVerifiedAt: true,
            buddyProfile: { select: { isAvailable: true } },
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            isSmallPrivateGroup: true,
          },
        },
        comments: {
          where: { moderationStatus: { not: "REMOVED" } },
          select: {
            authorUserId: true,
            author: {
              select: {
                id: true,
                trustTier: true,
                buddyProfile: { select: { isAvailable: true } },
              },
            },
          },
        },
        reactions: {
          select: {
            userId: true,
            reactionType: true,
            user: {
              select: {
                id: true,
                trustTier: true,
                buddyProfile: { select: { isAvailable: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const circleUserIds = new Set(
    circleConversations.map((conversation) => (conversation.userOneId === viewer.id ? conversation.userTwoId : conversation.userOneId)),
  );

  const eventPosts = posts.filter((post) => looksEventRelated([post.contentText, post.group?.name ?? ""].join(" ")));

  const eventSignals: EventSignal[] = eventPosts.map((post) => {
    const timing = deriveTimingLabel(post.contentText, post.createdAt);
    const goingCount = post.reactions.filter((reaction) => reaction.reactionType === ReactionType.CELEBRATE).length;
    const interestedCount = post.reactions.filter((reaction) => reaction.reactionType === ReactionType.SUPPORT).length;
    const viewerReaction = post.reactions.find((reaction) => reaction.userId === viewer.id)?.reactionType ?? null;

    const participantIds = new Set<string>([
      post.authorUserId,
      ...post.comments.map((comment) => comment.authorUserId),
      ...post.reactions.map((reaction) => reaction.userId),
    ]);
    participantIds.delete(viewer.id);

    const participantProfiles = [
      post.author,
      ...post.comments.map((comment) => comment.author),
      ...post.reactions.map((reaction) => reaction.user),
    ].filter((participant, index, array) => array.findIndex((entry) => entry.id === participant.id) === index);

    const circleCount = Array.from(participantIds).filter((participantId) => circleUserIds.has(participantId)).length;
    const highTrustCount = participantProfiles.filter((participant) => participant.id !== viewer.id && participant.trustTier === "HIGH").length;
    const buddyReadyCount = participantProfiles.filter((participant) => participant.id !== viewer.id && participant.buddyProfile?.isAvailable).length;
    const isPrivate = Boolean(post.group?.isSmallPrivateGroup || post.contextType === PostContextType.GROUP);

    const chips = [
      post.group?.name ? `Shared in ${post.group.name}` : "Community thread",
      circleCount > 0 ? `${circleCount} from your circle` : "Shared more quietly",
      buddyReadyCount > 0 ? `${buddyReadyCount} buddy-ready` : "Conversation first",
    ].slice(0, 3);

    const signals = [
      circleCount > 0 ? `${circleCount} from your circle` : null,
      highTrustCount > 0 ? `${highTrustCount} high-trust active` : null,
      buddyReadyCount > 0 ? `${buddyReadyCount} buddy-ready` : null,
    ].filter((value): value is string => Boolean(value));

    return {
      id: post.id,
      body: post.contentText,
      chips,
      ctaHref: `/posts/${post.id}`,
      ctaLabel: "View thread",
      emailVerified: Boolean(post.author.emailVerified),
      goingCount,
      groupId: post.groupId,
      interestedCount,
      overline: post.group ? "Trusted room" : "Event thread",
      phoneVerified: Boolean(post.author.phoneVerifiedAt),
      postId: post.id,
      privacyLabel: isPrivate ? "Private" : "Area later",
      reactionType: viewerReaction === ReactionType.SUPPORT || viewerReaction === ReactionType.CELEBRATE ? viewerReaction : null,
      scopeLabel: post.group ? `Shared in ${post.group.name}` : circleCount > 0 ? "From your circle" : "Wider community",
      signals,
      statusNote: isPrivate ? "Shared inside trusted circle" : "Location reveals later",
      timingBucket: timing.bucket,
      timingLabel: timing.label,
      title: trimTitle(post.contentText),
      trustTier: post.author.trustTier,
      circleCount,
      isPrivate,
    };
  });

  const featuredThreadSignal = eventSignals[0] ?? null;
  const placementMatchesQuery = !query || `${promotedPlacement?.eventPromotion.title ?? ""} ${promotedPlacement?.eventPromotion.description ?? ""}`.toLowerCase().includes(query.toLowerCase());
  const featuredSignal: EventSignal | null = promotedPlacement && placementMatchesQuery
    ? {
        id: promotedPlacement.id,
        body: promotedPlacement.eventPromotion.description ?? "A discreet event is circulating through trusted circles right now.",
        chips: [
          featuredThreadSignal?.circleCount ? `${featuredThreadSignal.circleCount} from your circle` : "Shared inside trusted circles",
          promotedPlacement.eventPromotion.couponCode ? `Code ${promotedPlacement.eventPromotion.couponCode}` : "Area unlocks later",
        ],
        ctaHref: featuredThreadSignal ? `/posts/${featuredThreadSignal.postId}` : promotedPlacement.eventPromotion.externalLink,
        ctaLabel: featuredThreadSignal ? "View thread" : "Open",
        emailVerified: featuredThreadSignal?.emailVerified ?? false,
        goingCount: featuredThreadSignal?.goingCount ?? 0,
        groupId: featuredThreadSignal?.groupId ?? null,
        interestedCount: featuredThreadSignal?.interestedCount ?? 0,
        overline: "Featured/community pick",
        phoneVerified: featuredThreadSignal?.phoneVerified ?? false,
        postId: featuredThreadSignal?.postId ?? null,
        privacyLabel: featuredThreadSignal?.privacyLabel ?? "Area later",
        reactionType: featuredThreadSignal?.reactionType ?? null,
        scopeLabel: featuredThreadSignal?.scopeLabel ?? "Trusted circle",
        signals: featuredThreadSignal?.signals ?? [],
        statusNote: "The thread sets the tone before details open up",
        timingBucket: formatStartsAt(promotedPlacement.eventPromotion.startsAt).bucket,
        timingLabel: formatStartsAt(promotedPlacement.eventPromotion.startsAt).label,
        title: promotedPlacement.eventPromotion.title,
        trustTier: featuredThreadSignal?.trustTier ?? null,
        circleCount: featuredThreadSignal?.circleCount ?? 0,
        isPrivate: featuredThreadSignal?.isPrivate ?? false,
      }
    : null;

  const tonightSignals = eventSignals.filter((signal) => signal.timingBucket === "tonight");
  const upcomingSignals = eventSignals.filter((signal) => signal.timingBucket === "upcoming");
  const circleSignals = eventSignals.filter((signal) => signal.circleCount > 0);
  const privateSignals = eventSignals.filter((signal) => signal.isPrivate);

  const sections = {
    featured: activeTab === "all",
    tonight: activeTab === "all" || activeTab === "tonight",
    upcoming: activeTab === "all" || activeTab === "upcoming",
    circle: activeTab === "all" || activeTab === "circle",
    private: activeTab === "all" || activeTab === "private",
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 pb-[calc(var(--member-shell-bottom-offset)+1rem)] pt-[calc(var(--member-shell-top-offset)+0.6rem)] md:px-5 md:pb-14 md:pt-[calc(var(--member-shell-top-offset-md)+0.75rem)]" data-testid="events-page">
      <HomeTopBar notificationCount={notificationCount} viewerInitial={viewer.displayName.slice(0, 1).toUpperCase()} />

      <section className="mt-4 rounded-[2rem] border border-[rgba(255,255,255,0.06)] bg-[radial-gradient(circle_at_top,rgba(94,67,60,0.14),transparent_24%),linear-gradient(180deg,#17181c_0%,#111218_100%)] px-4 py-5 text-white shadow-[0_28px_74px_rgba(7,8,10,0.24)] md:px-6 md:py-6">
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/44">Events</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-[1.9rem] font-semibold tracking-tight text-white md:text-[2.5rem]">Tonight and upcoming, held inside the community.</h1>
            <p className="mt-3 text-sm leading-7 text-white/64 md:text-[15px]">
              Events here should feel like discreet signals you can move toward naturally, with the thread and your circle giving enough context first.
            </p>
          </div>
          <form action="/events" className="w-full max-w-xl">
            <input name="tab" type="hidden" value={activeTab === "all" ? "" : activeTab} />
            <div className="flex items-center gap-3 rounded-[1.2rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <input
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/38"
                defaultValue={query}
                name="query"
                placeholder="Search quieter event signals"
              />
              <button className="rounded-full bg-[rgba(229,181,98,0.14)] px-4 py-2 text-sm font-medium text-[#f1ddb2] transition hover:bg-[rgba(229,181,98,0.2)]" type="submit">
                Search
              </button>
            </div>
          </form>
        </div>

        <div className="mt-5">
          <EventFilterChips activeTab={activeTab} query={query} />
        </div>
      </section>

      <div className="mt-5 space-y-6">
        {sections.featured && featuredSignal ? (
          <section className="space-y-4" data-testid="events-section-featured">
            <SectionHeader
              overline="Featured"
              title="A community pick already gaining tone"
              description="The strongest event surface is still the room around it, so this card leans toward the thread when one already exists."
            />
            <EventSignalCard {...featuredSignal} />
          </section>
        ) : null}

        {sections.tonight ? (
          <section className="space-y-4" data-testid="events-section-tonight">
            <SectionHeader
              overline="Tonight"
              title="Signals moving right now"
              description="What feels live, soft, and socially legible tonight."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {tonightSignals.length === 0 ? emptyState("No tonight signals are visible in this view yet.") : tonightSignals.map((signal) => <EventSignalCard key={signal.id} {...signal} />)}
            </div>
          </section>
        ) : null}

        {sections.upcoming ? (
          <section className="space-y-4" data-testid="events-section-upcoming">
            <SectionHeader
              overline="Upcoming"
              title="Plans taking shape a little further out"
              description="Upcoming moments stay calm and contextual instead of turning into a marketplace wall."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {upcomingSignals.length === 0 ? emptyState("Nothing upcoming matches this filter yet.") : upcomingSignals.map((signal) => <EventSignalCard key={signal.id} {...signal} />)}
            </div>
          </section>
        ) : null}

        {sections.circle ? (
          <section className="space-y-4" data-testid="events-section-circle">
            <SectionHeader
              overline="From your circle"
              title="Where your circles already have momentum"
              description="Aggregate signals only, enough to build comfort without exposing who is where."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {circleSignals.length === 0 ? emptyState("No circle-linked event signals are visible right now.") : circleSignals.map((signal) => <EventSignalCard key={signal.id} {...signal} />)}
            </div>
          </section>
        ) : null}

        {sections.private ? (
          <section className="space-y-4" data-testid="events-section-private">
            <SectionHeader
              overline="Private / invite-oriented"
              title="Shared more selectively"
              description="Private rooms and softer reveal language stay visible without exposing too much too early."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {privateSignals.length === 0 ? emptyState("No private event signals match this view yet.") : privateSignals.map((signal) => <EventSignalCard key={signal.id} {...signal} />)}
            </div>
          </section>
        ) : null}
      </div>

      <div className="mt-8 text-center text-[11px] uppercase tracking-[0.2em] text-white/36">
        Need a wider discovery sweep? <a className="text-white/62 underline-offset-4 hover:text-white hover:underline" href={buildEventsQueryHref("all", query)}>Stay with event signals</a> or keep moving through <a className="text-white/62 underline-offset-4 hover:text-white hover:underline" href="/search">Explore</a>.
      </div>

      <HomeBottomNav />
    </main>
  );
}





