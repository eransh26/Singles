import { LegalPage } from "@/components/legal/legal-page";

const termsSections = [
  {
    title: "Eligibility",
    paragraphs: [
      "Users must be at least 18 years old.",
    ],
  },
  {
    title: "Account Responsibility",
    paragraphs: [
      "Users are responsible for their account and activities.",
    ],
  },
  {
    title: "Acceptable Use",
    paragraphs: [
      "Users must not harass, abuse, or share illegal content.",
      "All interactions must be consensual.",
    ],
  },
  {
    title: "Adult Content & Conduct",
    paragraphs: [
      "Evyta allows adult-oriented interactions and content.",
      "Non-consensual behavior or illegal content is strictly prohibited.",
    ],
  },
  {
    title: "Events",
    paragraphs: [
      "Evyta may promote or host events. Participation is voluntary and at user’s own risk.",
      "Event organizers may have additional rules.",
    ],
  },
  {
    title: "Marketplace / Goods",
    paragraphs: [
      "Evyta may offer adult-oriented goods.",
      "All purchases are subject to third-party payment providers and applicable laws.",
    ],
  },
  {
    title: "Communication Features",
    paragraphs: [
      "Private chat and video calls are provided as-is. Users are responsible for their conduct.",
    ],
  },
  {
    title: "Privacy & Safety",
    paragraphs: [
      "Users can block/report others.",
      "We may suspend accounts for violations.",
    ],
  },
  {
    title: "Termination",
    paragraphs: [
      "We may suspend or terminate accounts at our discretion.",
    ],
  },
  {
    title: "Liability",
    paragraphs: [
      "Evyta is not responsible for user interactions, event outcomes, or purchased goods.",
    ],
  },
  {
    title: "Changes",
    paragraphs: [
      "Terms may be updated periodically.",
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      intro="These terms govern access to Evyta’s community, communication, event, and commerce features without changing the product’s existing trust and moderation rules."
      sections={termsSections.map((section) => ({ ...section, paragraphs: [...section.paragraphs] }))}
      title="Evyta Terms of Service"
    />
  );
}
