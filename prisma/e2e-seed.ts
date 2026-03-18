import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  AccountStatus,
  ChatRequestPolicy,
  GroupRole,
  GroupType,
  MediaType,
  MediaVisibilityLevel,
  MembershipStatus,
  PhotoRequestPolicy,
  ProfileVisibility,
  VerificationStatus,
  PostContextType,
  UserRole,
  ReportTargetType,
  ReportStatus,
} from "@prisma/client";

function loadEnvFile(fileName: string) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

if (process.env.E2E_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
}

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL or E2E_DATABASE_URL before running the E2E seed.");
}

const prisma = new PrismaClient();
const PASSWORD = "12345678a";
const TEST_USER_PASSWORD = "Test1234!";
const VERIFIED_AT = new Date("2026-01-15T10:00:00.000Z");

async function upsertInterest(name: string, slug: string) {
  return prisma.interest.upsert({
    where: { slug },
    update: { name, isActive: true },
    create: { name, slug },
    select: { id: true, name: true },
  });
}

async function createUser(options: {
  email: string;
  displayName: string;
  passwordHash: string;
  role?: UserRole;
  verifiedPrerequisites?: boolean;
  verificationStatus?: VerificationStatus;
  profileVisibility?: ProfileVisibility;
  chatRequestPolicy?: ChatRequestPolicy;
  photoRequestPolicy?: PhotoRequestPolicy;
  image?: string;
  bio?: string;
}) {
  const verifiedPrerequisites = options.verifiedPrerequisites ?? false;

  const user = await prisma.user.upsert({
    where: { email: options.email },
    update: {
      passwordHash: options.passwordHash,
      displayName: options.displayName,
      role: options.role ?? UserRole.USER,
      accountStatus: AccountStatus.ACTIVE,
      profileVisibility: options.profileVisibility ?? ProfileVisibility.MEMBERS_ONLY,
      chatRequestPolicy: options.chatRequestPolicy ?? ChatRequestPolicy.EVERYONE,
      photoRequestPolicy: options.photoRequestPolicy ?? PhotoRequestPolicy.VERIFIED_ONLY,
      emailVerified: verifiedPrerequisites ? VERIFIED_AT : null,
      phoneVerifiedAt: verifiedPrerequisites ? VERIFIED_AT : null,
      ageVerified: verifiedPrerequisites,
      verificationStatus: options.verificationStatus ?? (verifiedPrerequisites ? VerificationStatus.APPROVED : VerificationStatus.NONE),
      image: options.image,
      bio: options.bio,
    },
    create: {
      email: options.email,
      passwordHash: options.passwordHash,
      displayName: options.displayName,
      role: options.role ?? UserRole.USER,
      accountStatus: AccountStatus.ACTIVE,
      profileVisibility: options.profileVisibility ?? ProfileVisibility.MEMBERS_ONLY,
      chatRequestPolicy: options.chatRequestPolicy ?? ChatRequestPolicy.EVERYONE,
      photoRequestPolicy: options.photoRequestPolicy ?? PhotoRequestPolicy.VERIFIED_ONLY,
      emailVerified: verifiedPrerequisites ? VERIFIED_AT : null,
      phoneVerifiedAt: verifiedPrerequisites ? VERIFIED_AT : null,
      ageVerified: verifiedPrerequisites,
      verificationStatus: options.verificationStatus ?? (verifiedPrerequisites ? VerificationStatus.APPROVED : VerificationStatus.NONE),
      image: options.image,
      bio: options.bio,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      image: true,
    },
  });

  return user;
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const testUserPasswordHash = await bcrypt.hash(TEST_USER_PASSWORD, 10);

  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.buddyVideoConsent.deleteMany();
  await prisma.videoCallRecord.deleteMany();
  await prisma.videoConsent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.buddyRequestAssignment.deleteMany();
  await prisma.buddyRequest.deleteMany();
  await prisma.buddyProfileDomain.deleteMany();
  await prisma.buddyProfile.deleteMany();
  await prisma.chatRequest.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.postReaction.deleteMany();
  await prisma.postMedia.deleteMany();
  await prisma.post.deleteMany();
  await prisma.groupJoinAnswer.deleteMany();
  await prisma.groupJoinRequest.deleteMany();
  await prisma.groupJoinQuestion.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.eventPromotionPlacement.deleteMany();
  await prisma.eventPromotion.deleteMany();
  await prisma.group.deleteMany();
  await prisma.photoAccessGrant.deleteMany();
  await prisma.photoAccessRequest.deleteMany();
  await prisma.userProfileMedia.deleteMany();
  await prisma.userInterest.deleteMany();
  await prisma.verificationRequest.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.interest.deleteMany();

  const interests = await Promise.all([
    upsertInterest("Wellness", "wellness"),
    upsertInterest("Travel", "travel"),
    upsertInterest("Events", "events"),
    upsertInterest("Culture", "culture"),
  ]);

  const admin = await createUser({
    email: "admin@example.com",
    displayName: "Admin Avery",
    passwordHash,
    role: UserRole.ADMIN,
    verifiedPrerequisites: true,
  });

  const owner = await createUser({
    email: "owner@example.com",
    displayName: "Owner One",
    passwordHash,
    verifiedPrerequisites: true,
    profileVisibility: ProfileVisibility.MEMBERS_ONLY,
    chatRequestPolicy: ChatRequestPolicy.EVERYONE,
    photoRequestPolicy: PhotoRequestPolicy.VERIFIED_ONLY,
  });

  const member = await createUser({
    email: "member@example.com",
    displayName: "Member Uno",
    passwordHash,
  });

  const verified = await createUser({
    email: "verified@example.com",
    displayName: "Verified Vera",
    passwordHash,
    verifiedPrerequisites: true,
  });

  const blockedRequester = await createUser({
    email: "blocked@example.com",
    displayName: "Blocked Blake",
    passwordHash,
    verifiedPrerequisites: true,
  });

  const blockedTarget = await createUser({
    email: "blocked-target@example.com",
    displayName: "Blocked Target",
    passwordHash,
    verifiedPrerequisites: true,
  });

  const verificationApproveUser = await createUser({
    email: "verification-approve@example.com",
    displayName: "Verification Ready",
    passwordHash,
    verifiedPrerequisites: true,
    verificationStatus: VerificationStatus.PENDING,
  });

  const verificationRejectUser = await createUser({
    email: "verification-reject@example.com",
    displayName: "Verification Reject",
    passwordHash,
    verifiedPrerequisites: true,
    verificationStatus: VerificationStatus.PENDING,
  });

  const defaultTestUsers = await Promise.all([
    createUser({
      email: "test.male1@evyta.dev",
      displayName: "Eitan Vale",
      passwordHash: testUserPasswordHash,
      image: "/avatars/avatar-male-1.svg",
      bio: "Default seeded male profile for local testing.",
    }),
    createUser({
      email: "test.female1@evyta.dev",
      displayName: "Lia Morel",
      passwordHash: testUserPasswordHash,
      image: "/avatars/avatar-female-1.svg",
      bio: "Default seeded female profile for local testing.",
    }),
    createUser({
      email: "test.male2@evyta.dev",
      displayName: "Noam Darel",
      passwordHash: testUserPasswordHash,
      image: "/avatars/avatar-male-2.svg",
      bio: "Default seeded male profile for local testing.",
    }),
    createUser({
      email: "test.female2@evyta.dev",
      displayName: "Maya Sol",
      passwordHash: testUserPasswordHash,
      image: "/avatars/avatar-female-2.svg",
      bio: "Default seeded female profile for local testing.",
    }),
    createUser({
      email: "test.user@evyta.dev",
      displayName: "Ari Quinn",
      passwordHash: testUserPasswordHash,
      image: "/avatars/avatar-neutral-1.svg",
      bio: "Default seeded neutral profile for local testing.",
    }),
  ]);


  const [testMale1, testFemale1, testMale2, testFemale2, testUser] = defaultTestUsers;

  await prisma.buddyProfile.createMany({
    data: [
      { userId: testMale1.id, isAvailable: true, intro: "Grounded peer support for starting over and emotional overwhelm.", availabilityLevel: "STANDARD" },
      { userId: testFemale1.id, isAvailable: true, intro: "Soft support for emotional resets and dating after divorce.", availabilityLevel: "LIGHT" },
      { userId: testMale2.id, isAvailable: true, intro: "Experienced with private lifestyle guidance and relationship support.", availabilityLevel: "HIGH" },
    ],
    skipDuplicates: true,
  });

  await prisma.buddyProfileDomain.createMany({
    data: [
      { userId: testMale1.id, domain: "EMOTIONAL_SUPPORT" },
      { userId: testMale1.id, domain: "STARTING_OVER" },
      { userId: testFemale1.id, domain: "EMOTIONAL_SUPPORT" },
      { userId: testFemale1.id, domain: "DATING_AFTER_DIVORCE" },
      { userId: testMale2.id, domain: "BDSM_GUIDANCE" },
      { userId: testMale2.id, domain: "RELATIONSHIP_SUPPORT" },
    ],
    skipDuplicates: true,
  });

  const expiringCreatedAt = new Date(Date.now() - 49 * 60 * 60 * 1000);
  const autoCancelCreatedAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const autoCancelPromptedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const expiringBuddyRequest = await prisma.buddyRequest.create({
    data: {
      seekerId: testUser.id,
      domain: "EMOTIONAL_SUPPORT",
      message: "Looking for some calm peer support while rebuilding life.",
      preferredMode: "CHAT_ONLY",
      status: "PENDING",
      createdAt: expiringCreatedAt,
      updatedAt: expiringCreatedAt,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      assignments: {
        create: [
          { buddyId: testMale1.id, status: "PENDING", createdAt: expiringCreatedAt },
        ],
      },
    },
    select: { id: true },
  });

  const autoCancelledBuddyRequest = await prisma.buddyRequest.create({
    data: {
      seekerId: testUser.id,
      domain: "RELATIONSHIP_SUPPORT",
      message: "Need a sounding board after a difficult breakup.",
      preferredMode: "EITHER",
      status: "AWAITING_SEEKER_DECISION",
      createdAt: autoCancelCreatedAt,
      updatedAt: autoCancelCreatedAt,
      extensionPromptAt: autoCancelPromptedAt,
      expiresAt: new Date(autoCancelCreatedAt.getTime() + 48 * 60 * 60 * 1000),
      assignments: {
        create: [
          { buddyId: testMale2.id, status: "DECLINED", createdAt: autoCancelCreatedAt, respondedAt: autoCancelPromptedAt },
        ],
      },
    },
    select: { id: true },
  });
  await prisma.userInterest.createMany({
    data: [
      { userId: owner.id, interestId: interests[0].id },
      { userId: owner.id, interestId: interests[1].id },
      { userId: verified.id, interestId: interests[2].id },
    ],
    skipDuplicates: true,
  });

  await prisma.verificationRequest.createMany({
    data: [
      { userId: verificationApproveUser.id, status: VerificationStatus.PENDING },
      { userId: verificationRejectUser.id, status: VerificationStatus.PENDING },
    ],
  });

  const closedGroup = await prisma.group.create({
    data: {
      name: "Quiet Circle",
      slug: "quiet-circle",
      description: "A closed group used for Milestone 3 E2E coverage.",
      groupType: GroupType.CLOSED,
      createdByUserId: owner.id,
      memberships: {
        create: {
          userId: owner.id,
          role: GroupRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      },
    },
    select: { id: true, name: true },
  });

  const reportedPost = await prisma.post.create({
    data: {
      authorUserId: member.id,
      contextType: PostContextType.GLOBAL_FEED,
      contentText: "Reportable post content that should disappear after moderation.",
      isAnonymous: false,
    },
    select: { id: true, contentText: true },
  });

  await prisma.post.create({
    data: {
      authorUserId: owner.id,
      contextType: PostContextType.GROUP,
      groupId: closedGroup.id,
      contentText: "Hidden circle post for members only.",
      isAnonymous: false,
    },
  });

  const postReport = await prisma.report.create({
    data: {
      targetType: ReportTargetType.POST,
      reasonCode: "SAFETY",
      details: "This seeded post should be hidden by the admin moderation flow.",
      status: ReportStatus.OPEN,
      filedBy: { connect: { id: owner.id } },
      targetPost: { connect: { id: reportedPost.id } },
    },
    select: { id: true },
  });

  await prisma.userProfileMedia.createMany({
    data: [
      {
        userId: owner.id,
        mediaType: MediaType.PROFILE,
        storageKey: "https://example.com/profile-owner.jpg",
        visibilityLevel: MediaVisibilityLevel.PUBLIC,
        sortOrder: 0,
      },
      {
        userId: owner.id,
        mediaType: MediaType.GALLERY,
        storageKey: "https://example.com/gallery-owner-approved.jpg",
        visibilityLevel: MediaVisibilityLevel.APPROVED,
        sortOrder: 0,
      },
    ],
  });

  await prisma.userBlock.create({
    data: {
      blockerUserId: blockedTarget.id,
      blockedUserId: blockedRequester.id,
      reason: "E2E blocked pair",
    },
  });

  const approvedChatRequest = await prisma.chatRequest.create({
    data: {
      fromUserId: owner.id,
      toUserId: verified.id,
      pairKey: [owner.id, verified.id].sort().join(":"),
      status: "ACCEPTED",
      respondedAt: new Date("2026-02-01T10:00:00.000Z"),
    },
    select: { id: true },
  });

  const approvedConversation = await prisma.conversation.create({
    data: {
      userOneId: owner.id,
      userTwoId: verified.id,
      pairKey: [owner.id, verified.id].sort().join(":"),
      createdFromChatRequestId: approvedChatRequest.id,
      status: "ACTIVE",
      messages: {
        create: {
          senderUserId: owner.id,
          body: "Welcome to the private chat.",
        },
      },
    },
    select: { id: true },
  });

  const manifest = {
    password: PASSWORD,
    defaultTestUserPassword: TEST_USER_PASSWORD,
    users: {
      admin,
      owner,
      member,
      verified,
      blockedRequester,
      blockedTarget,
      verificationApproveUser,
      verificationRejectUser,
      defaultTestUsers,
    },
    groups: {
      closedGroup,
    },
    posts: {
      reportedPost,
    },
    reports: {
      postReport,
    },
    conversations: {
      approvedConversation,
    },
  };

  const outputDir = path.join(process.cwd(), "tests", "e2e");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, ".seed-data.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("E2E seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });






