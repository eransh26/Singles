import { prisma } from "../src/lib/db/prisma";

async function main() {
  const interests = [
    { name: "Wellness", slug: "wellness" },
    { name: "Travel", slug: "travel" },
    { name: "Events", slug: "events" },
    { name: "Culture", slug: "culture" },
  ];

  for (const interest of interests) {
    await prisma.interest.upsert({
      where: { slug: interest.slug },
      update: { name: interest.name, isActive: true },
      create: interest,
    });
  }

  const featureFlags = [
    {
      key: "buddy_enabled",
      enabled: true,
      description: "Controls Buddy applications, Buddy requests, and Buddy conversations.",
      rolloutType: "GLOBAL",
    },
    {
      key: "single_of_week_enabled",
      enabled: true,
      description: "Controls Single of the Week applications, hero card, and featured request flow.",
      rolloutType: "GLOBAL",
    },
  ] as const;

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: flag,
      create: flag,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });