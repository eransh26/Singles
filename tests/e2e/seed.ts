import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const seedDataPath = path.join(process.cwd(), "tests", "e2e", ".seed-data.json");

export type SeedUser = { id: string; email: string; displayName: string; image?: string | null };

export type SeedData = {
  defaultTestUserPassword?: string;
  password: string;
  users: {
    admin: SeedUser;
    owner: SeedUser;
    member: SeedUser;
    verified: SeedUser;
    lowTrust?: SeedUser;
    blockedRequester: SeedUser;
    blockedTarget: SeedUser;
    reportedMember?: SeedUser;
    verificationApproveUser: SeedUser;
    verificationRejectUser: SeedUser;
    defaultTestUsers?: SeedUser[];
    testMale1?: SeedUser;
    testFemale1?: SeedUser;
    testMale2?: SeedUser;
    testFemale2?: SeedUser;
    testUser?: SeedUser;
  };
  groups: {
    closedGroup: { id: string; name: string };
  };
  posts: {
    reportedPost: { id: string; contentText: string };
    eventThreadPost?: { id: string; contentText: string };
  };
  reports: {
    postReport: { id: string };
  };
  conversations?: {
    approvedConversation: { id: string };
    lowTrustApprovedConversation?: { id: string };
  };
  singleOfWeek?: {
    currentFeature?: { id: string };
    pendingFeaturedApplication?: { id: string };
    reportedMember?: SeedUser;
  };
  buddy?: {
    expiringBuddyRequest?: { id: string };
    autoCancelledBuddyRequest?: { id: string };
    domains?: Record<string, { id: string; name: string }>;
  };
};

function runSeed() {
  execSync("npm run test:e2e:seed", {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: "powershell.exe",
    env: {
      ...process.env,
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL,
    },
  });
}

export function ensureE2ESeed() {
  if (!existsSync(seedDataPath)) {
    runSeed();
    return;
  }

  try {
    const current = JSON.parse(readFileSync(seedDataPath, "utf8")) as Partial<SeedData>;
    const hasCoreUsers = Boolean(
      current.users?.admin?.email &&
        current.users?.owner?.email &&
        current.users?.member?.email &&
        current.users?.verified?.email,
    );
    const hasClosedGroup = Boolean(current.groups?.closedGroup?.id);
    const hasReport = Boolean(current.reports?.postReport?.id && current.posts?.reportedPost?.id);
    const hasApprovedConversation = Boolean(current.conversations?.approvedConversation?.id);

    if (!hasCoreUsers || !hasClosedGroup || !hasReport || !hasApprovedConversation) {
      runSeed();
    }
  } catch {
    runSeed();
  }
}

export function resetE2EState() {
  runSeed();
}

export function loadSeedData(): SeedData {
  ensureE2ESeed();
  return JSON.parse(readFileSync(seedDataPath, "utf8")) as SeedData;
}
