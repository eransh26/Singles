import Link from "next/link";

import { ConversationKind, ConversationStatus, MembershipStatus, PlacementType, PostContextType, PostVisibilityStatus } from "@prisma/client";

import { requireUser } from "@/lib/auth/guards";

import { prisma } from "@/lib/db/prisma";

import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";

import { resolveProfileImageUrl, resolveSingleOfWeekPhotoUrl } from "@/lib/media-display";

import { getPromotedPlacement } from "@/lib/promotions";

import { syncSingleOfWeekState } from "@/lib/single-of-the-week";

import { DiscoveryMemberCard } from "@/components/discovery/discovery-member-card";

import { SectionHeader } from "@/components/discovery/section-header";

import { HomeSignalCard } from "@/components/home/signal-card";

import { HomeTopBar } from "@/components/home/top-bar";



type ExploreTab = "all" | "people" | "events" | "buddy" | "featured";



const TABS: Array<{ value: ExploreTab; label: string }> = [

  { value: "all", label: "All" },

  { value: "people", label: "People" },

  { value: "events", label: "Events" },

  { value: "buddy", label: "Buddy" },

  { value: "featured", label: "Featured" },

];



function buildExploreHref(tab: ExploreTab, query: string) {

  const params = new URLSearchParams();

  if (tab !== "all") {

    params.set("tab", tab);

  }

  if (query) {

    params.set("query", query);

  }

  const suffix = params.toString();

  return suffix ? `/search?${suffix}` : "/search";

}



export default async function SearchPage({

  searchParams,

}: {

  searchParams?: Promise<{ query?: string; tab?: string }>;

}) {

  const viewer = await requireUser();

  const resolvedSearchParams = await searchParams;

  const query = (resolvedSearchParams?.query ?? "").trim();

  const requestedTab = (resolvedSearchParams?.tab ?? "all").toLowerCase();

  const activeTab = TABS.some((tab) => tab.value === requestedTab) ? (requestedTab as ExploreTab) : "all";



  const singleOfWeekEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.singleOfWeek, viewer);

  const buddyEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.buddy, viewer);



  const memberships = await prisma.groupMembership.findMany({

    where: { userId: viewer.id, status: MembershipStatus.ACTIVE },

    select: { groupId: true },

  });

  const visibleGroupIds = memberships.map((membership) => membership.groupId);



  const [notificationCount, circleConversations, featuredState, promotedPlacement, members, buddyMembers, recentPosts] = await Promise.all([

    prisma.notification.count({ where: { userId: viewer.id, readAt: null } }),

    prisma.conversation.findMany({

      where: {

        kind: ConversationKind.MEMBER_CHAT,

        status: ConversationStatus.ACTIVE,

        OR: [{ userOneId: viewer.id }, { userTwoId: viewer.id }],

      },

      select: { userOneId: true, userTwoId: true },

      take: 20,

      orderBy: { updatedAt: "desc" },

    }),

    singleOfWeekEnabled ? syncSingleOfWeekState() : Promise.resolve(null),

    getPromotedPlacement(PlacementType.HOME_FEED_CARD),

    prisma.user.findMany({

      where: {

        role: "USER",

        id: { not: viewer.id },

        OR: query

          ? [

              { displayName: { contains: query, mode: "insensitive" } },

              { region: { contains: query, mode: "insensitive" } },

              { bio: { contains: query, mode: "insensitive" } },

            ]

          : undefined,

      },

      orderBy: [{ trustUpdatedAt: "desc" }, { createdAt: "desc" }],

      take: 8,

      select: {

        id: true,

        displayName: true,

        bio: true,

        region: true,

        trustTier: true,

        emailVerified: true,

        phoneVerifiedAt: true,

        image: true,

        createdAt: true,

        profileImageAssets: {

          where: { moderationStatus: "APPROVED", hiddenByModeration: false },

          orderBy: { uploadedAt: "desc" },

          take: 1,

          select: { id: true, storageProvider: true },

        },

        buddyProfile: {

          select: { isAvailable: true },

        },

      },

    }),

    buddyEnabled

      ? prisma.user.findMany({

          where: {

            role: "USER",

            id: { not: viewer.id },

            buddyProfile: { is: { isAvailable: true } },

            OR: query

              ? [

                  { displayName: { contains: query, mode: "insensitive" } },

                  { bio: { contains: query, mode: "insensitive" } },

                  { buddyProfile: { is: { intro: { contains: query, mode: "insensitive" } } } },

                ]

              : undefined,

          },

          orderBy: [{ trustUpdatedAt: "desc" }, { createdAt: "desc" }],

          take: 6,

          select: {

            id: true,

            displayName: true,

            bio: true,

            region: true,

            trustTier: true,

            emailVerified: true,

            phoneVerifiedAt: true,

            image: true,

            profileImageAssets: {

              where: { moderationStatus: "APPROVED", hiddenByModeration: false },

              orderBy: { uploadedAt: "desc" },

              take: 1,

              select: { id: true, storageProvider: true },

            },

            buddyProfile: {

              select: { intro: true, availabilityLevel: true },

            },


          },

        })

      : Promise.resolve([]),

    prisma.post.findMany({

      where: {

        visibilityStatus: PostVisibilityStatus.VISIBLE,

        authorUserId: { not: viewer.id },

        contentText: query ? { contains: query, mode: "insensitive" } : undefined,

        OR: [

          { contextType: PostContextType.GLOBAL_FEED },

          {

            contextType: PostContextType.GROUP,

            groupId: { in: visibleGroupIds.length > 0 ? visibleGroupIds : ["__none__"] },

          },

        ],

      },

      orderBy: { createdAt: "desc" },

      take: 4,

      select: {

        id: true,

        contentText: true,

        createdAt: true,

        author: {

          select: {

            id: true,

            displayName: true,

            trustTier: true,

            emailVerified: true,

            phoneVerifiedAt: true,

          },

        },

        group: { select: { id: true, name: true } },

        _count: { select: { comments: true, reactions: true } },

      },

    }),

  ]);



  const circleUserIds = new Set(

    circleConversations.map((conversation) => (conversation.userOneId === viewer.id ? conversation.userTwoId : conversation.userOneId)),

  );



  const featuredMember = featuredState?.status === "ACTIVE" ? featuredState : null;

  const featuredPhotoUrl = featuredMember

    ? featuredMember.application.photos.map((photo) => resolveSingleOfWeekPhotoUrl(photo)).find((value): value is string => Boolean(value)) ?? null

    : null;

  const featuredTrustUser = featuredMember

    ? await prisma.user.findUnique({

        where: { id: featuredMember.featuredUserId },

        select: { trustTier: true, emailVerified: true, phoneVerifiedAt: true, verificationStatus: true, kycVerified: true, buddyProfile: { select: { domains: { select: { id: true }, take: 1 } } } },

      })

    : null;



  const sections = {

    featured: activeTab === "all" || activeTab === "featured",

    events: activeTab === "all" || activeTab === "events",

    people: activeTab === "all" || activeTab === "people",

    buddy: activeTab === "all" || activeTab === "buddy",

    community: activeTab === "all",

  };



  return (

    <main className="mx-auto min-h-screen max-w-6xl px-3 pb-[calc(var(--member-shell-bottom-offset)+1rem)] pt-3 md:px-5 md:pb-14 md:pt-4" data-testid="explore-page">

      <HomeTopBar notificationCount={notificationCount} viewerInitial={viewer.displayName.slice(0, 1).toUpperCase()} />



      <section className="mt-4 rounded-[2rem] border border-[color:var(--ev-line)] bg-[radial-gradient(circle_at_top,rgba(201,164,92,0.10),transparent_30%),linear-gradient(180deg,#1d1813_0%,#0c0a08_100%)] px-4 py-5 text-[color:var(--ev-text)] shadow-[0_28px_74px_rgba(8,6,5,0.4)] md:px-6 md:py-6">

        <p className="text-[10px] uppercase tracking-[0.28em] text-white/44">Explore</p>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">

          <div className="max-w-2xl">

            <h1 className="text-[1.9rem] font-semibold tracking-tight text-white md:text-[2.5rem]">Discover the quiet signals moving through Evyta.</h1>

            <p className="mt-3 text-sm leading-7 text-white/64 md:text-[15px]">

              Explore feels more like noticing what is alive around you than browsing a catalog. Trust, context, and timing stay close to the surface.

            </p>

          </div>

          <form action="/search" className="w-full max-w-xl">

            <input name="tab" type="hidden" value={activeTab === "all" ? "" : activeTab} />

            <div className="flex items-center gap-3 rounded-[1.2rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">

              <input

                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/38"

                defaultValue={query}

                name="query"

                placeholder="Search people, posts, and quieter signals"

              />

              <button className="rounded-full bg-[rgba(229,181,98,0.14)] px-4 py-2 text-sm font-medium text-[#f1ddb2] transition hover:bg-[rgba(229,181,98,0.2)]" type="submit">

                Search

              </button>

            </div>

          </form>

        </div>



        <div className="mt-5 flex flex-wrap gap-2" data-testid="explore-filter-bar">

          {TABS.map((tab) => {

            const isActive = tab.value === activeTab;

            return (

              <Link

                className={`rounded-full border px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition ${

                  isActive

                    ? "border-[rgba(229,181,98,0.26)] bg-[rgba(229,181,98,0.12)] text-[#f1ddb2]"

                    : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white/62 hover:text-white"

                }`}

                data-testid={`explore-filter-${tab.value}`}

                href={buildExploreHref(tab.value, query)}

                key={tab.value}

              >

                {tab.label}

              </Link>

            );

          })}

        </div>

      </section>



      <div className="mt-5 space-y-6">

        {sections.featured && featuredMember ? (

          <section className="space-y-4" data-testid="explore-section-featured">

            <SectionHeader

              description="A featured signal should feel like a warm introduction inside the community, not a spotlighted ad."

              overline="Featured this week"

              title="One quieter connection to notice"

            />

            <HomeSignalCard

              body={featuredMember.application.bio}

              ctaHref={`/users/${featuredMember.featuredUserId}`}

              ctaLabel="View profile"

              emailVerified={Boolean(featuredTrustUser?.emailVerified)}

              meta={featuredMember.application.relationshipIntent}

              overline="Single of the Week"

              phoneVerified={Boolean(featuredTrustUser?.phoneVerifiedAt)}

              title={featuredMember.application.applicant.displayName}

              tone="featured"

              trustTier={featuredTrustUser?.trustTier ?? null}

            >

              {featuredPhotoUrl ? <img alt="Featured member" className="h-56 w-full rounded-[1.25rem] object-cover" src={featuredPhotoUrl} /> : null}

            </HomeSignalCard>

          </section>

        ) : null}



        {sections.events && promotedPlacement ? (

          <section className="space-y-4" data-testid="explore-section-events">

            <SectionHeader

              description="Event discovery stays attached to trust and timing, not a marketplace flow."

              overline="Tonight / upcoming"

              title="Community moments moving right now"

            />

            <HomeSignalCard

              body={promotedPlacement.eventPromotion.description ?? "A discreet event is circulating through trusted circles right now."}

              ctaHref={promotedPlacement.eventPromotion.externalLink}

              ctaLabel="Open"

              meta={promotedPlacement.eventPromotion.startsAt ? promotedPlacement.eventPromotion.startsAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Timing shared in thread"}

              overline="Event signal"

              title={promotedPlacement.eventPromotion.title}

              tone="event"

            />

          </section>

        ) : null}



        {sections.people ? (

          <section className="space-y-4" data-testid="explore-section-people">

            <SectionHeader

              description={query ? `Showing people connected to “${query}”.` : "Trust-aware people discovery stays quiet, compact, and rooted in context."}

              overline="People"

              title={circleUserIds.size > 0 ? "Verified and active around your circle" : "Community members worth opening"}

            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

              {members.length === 0 ? (

                <div className="rounded-[1.5rem] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-sm text-white/58">

                  No member signals match this filter yet.

                </div>

              ) : (

                members.map((member) => {

                  const imageUrl = resolveProfileImageUrl({ approvedProfileImageAsset: member.profileImageAssets[0] ?? null, legacyImage: member.image });

                  const chips = [

                    circleUserIds.has(member.id) ? "In your circle" : "Private profile",

                    member.region ? member.region : "Region later",

                    member.buddyProfile?.isAvailable ? "Buddy available" : "Conversation open",

                  ];



                  return (

                    <DiscoveryMemberCard

                      body={member.bio ?? "Quiet profile with enough context to know whether opening feels right."}

                      chips={chips}

                      emailVerified={Boolean(member.emailVerified)}

                      href={`/users/${member.id}`}

                      imageUrl={imageUrl}

                      initial={member.displayName.slice(0, 1).toUpperCase()}

                      key={member.id}

                      meta={circleUserIds.has(member.id) ? "Shared conversation history" : "New in the wider circle"}

                      phoneVerified={Boolean(member.phoneVerifiedAt)}

                      subtitle={member.region ?? "Region shared later"}

                      title={member.displayName}

                      trustTier={member.trustTier}

                    />

                  );

                })

              )}

            </div>

          </section>

        ) : null}



        {sections.buddy && buddyEnabled ? (

          <section className="space-y-4" data-testid="explore-section-buddy">

            <SectionHeader

              description="Support discovery is framed as calm availability and shared context, not matching."

              overline="Buddy"

              title="People open to steadier connection"

            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

              {buddyMembers.length === 0 ? (

                <div className="rounded-[1.5rem] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-sm text-white/58">

                  No Buddy signals match this filter yet.

                </div>

              ) : (

                buddyMembers.map((member) => {

                  const imageUrl = resolveProfileImageUrl({ approvedProfileImageAsset: member.profileImageAssets[0] ?? null, legacyImage: member.image });

                  const chips = [

                    "Open to connect",

                    member.buddyProfile?.availabilityLevel ? `${member.buddyProfile.availabilityLevel} availability` : "Buddy signal",

                    member.region ? member.region : "Region later",

                  ].slice(0, 3);



                  return (

                    <DiscoveryMemberCard

                      body={member.buddyProfile?.intro ?? member.bio ?? "Available for quieter support and steadier conversation."}

                      chips={chips}

                      emailVerified={Boolean(member.emailVerified)}

                      href={`/users/${member.id}`}

                      imageUrl={imageUrl}

                      initial={member.displayName.slice(0, 1).toUpperCase()}

                      key={member.id}

                      meta={member.buddyProfile?.availabilityLevel ? `${member.buddyProfile.availabilityLevel} availability` : "Buddy signal"}

                      phoneVerified={Boolean(member.phoneVerifiedAt)}

                      subtitle="Supportive context"

                      title={member.displayName}

                      trustTier={member.trustTier}

                    />

                  );

                })

              )}

            </div>

          </section>

        ) : null}



        {sections.community ? (

          <section className="space-y-4" data-testid="explore-section-community">

            <SectionHeader

              description={query ? `Recent activity touching “${query}”.` : "Small thread openings and community moments sit beside people discovery, not beneath it."}

              overline="Curated community signals"

              title="Threads worth opening next"

            />

            <div className="grid gap-4 lg:grid-cols-2">

              {recentPosts.length === 0 ? (

                <div className="rounded-[1.5rem] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-sm text-white/58">

                  No thread signals match this view yet.

                </div>

              ) : (

                recentPosts.map((post) => (

                  <HomeSignalCard

                    body={post.contentText}

                    ctaHref={`/posts/${post.id}`}

                    ctaLabel="Open thread"

                    emailVerified={Boolean(post.author.emailVerified)}

                    key={post.id}

                    meta={`${post._count.comments} replies • ${post._count.reactions} reactions`}

                    overline={post.group?.name ?? "Community pulse"}

                    phoneVerified={Boolean(post.author.phoneVerifiedAt)}

                    title={post.author.displayName}

                    tone="community"

                    trustTier={post.author.trustTier}

                  />

                ))

              )}

            </div>

          </section>

        ) : null}

      </div>


    </main>

  );

}





