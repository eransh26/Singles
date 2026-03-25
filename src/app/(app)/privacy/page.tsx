import { LegalPage } from "@/components/legal/legal-page";

const privacySections = [
  {
    title: "Scope",
    paragraphs: [
      "This Privacy Policy applies to Evyta, including community features, private messaging, video calls, events, and marketplace offerings.",
    ],
  },
  {
    title: "Data We Collect",
    paragraphs: [
      "Account and profile data, communication data, media uploads, event participation, and purchase-related data.",
      "We may also collect device and usage data for service improvement.",
    ],
  },
  {
    title: "Use of Data",
    paragraphs: [
      "To provide services, enable communication, process purchases, manage events, and ensure safety.",
      "To comply with legal obligations and prevent abuse.",
    ],
  },
  {
    title: "Adult Content & Sensitivity",
    paragraphs: [
      "Evyta includes adult-oriented interactions and products. Users control their participation.",
      "We do not monitor private communications except where required for safety or legal reasons.",
    ],
  },
  {
    title: "Data Sharing",
    paragraphs: [
      "We do not sell personal data.",
      "We may share data with service providers (e.g., payments, hosting, video infrastructure).",
      "We may disclose data if required by law.",
    ],
  },
  {
    title: "User Rights",
    paragraphs: [
      "Users may access, update, or request deletion of their data.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "We implement reasonable safeguards but cannot guarantee complete security.",
    ],
  },
  {
    title: "Events & Commerce",
    paragraphs: [
      "Participation in events and purchases of goods may involve third-party providers.",
      "Users are responsible for understanding the nature of adult-oriented goods and events.",
    ],
  },
  {
    title: "Changes",
    paragraphs: [
      "We may update this policy periodically.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      intro="This page explains how Evyta handles account, communication, event, and commerce data inside the product's existing trust-based experience."
      sections={privacySections.map((section) => ({ ...section, paragraphs: [...section.paragraphs] }))}
      title="Evyta Privacy Policy"
    />
  );
}
