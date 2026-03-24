"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const BUDDY_MAX_TEXT_LENGTH = 3000;

type DomainOption = {
  value: string;
  label: string;
};

type BuddyRequestFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  domainOptions: DomainOption[];
  initialDomainId?: string;
  initialMessage?: string;
};

export function BuddyRequestForm({ action, domainOptions, initialDomainId = "", initialMessage = "" }: BuddyRequestFormProps) {
  const [domainId, setDomainId] = useState(initialDomainId);
  const [message, setMessage] = useState(initialMessage);

  const errors = useMemo(() => ({
    domain: domainId ? null : "Choose one support domain.",
    message: message.length > BUDDY_MAX_TEXT_LENGTH ? `Keep your message under ${BUDDY_MAX_TEXT_LENGTH} characters.` : null,
  }), [domainId, message.length]);

  const isValid = Boolean(domainId) && !errors.message;

  return (
    <form action={action} className="mt-5 grid gap-4 text-sm text-[color:var(--lux-text-secondary)]">
      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Support domain</span>
        <select className="lux-select" name="domainId" onChange={(event) => setDomainId(event.target.value)} value={domainId}>
          <option value="">Choose one</option>
          {domainOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <span className={errors.domain ? "text-xs text-[color:var(--lux-danger)]" : "text-xs text-[color:var(--lux-text-muted)]"}>{errors.domain ?? "Required."}</span>
      </label>

      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Short message (optional)</span>
        <textarea
          className="lux-textarea min-h-[120px]"
          maxLength={BUDDY_MAX_TEXT_LENGTH}
          name="message"
          onChange={(event) => setMessage(event.target.value.slice(0, BUDDY_MAX_TEXT_LENGTH))}
          placeholder="Share a little context so the Buddy knows what kind of support would help."
          value={message}
        />
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className={errors.message ? "text-[color:var(--lux-danger)]" : "text-[color:var(--lux-text-muted)]"}>{errors.message ?? "Up to 3000 characters."}</span>
          <span className="text-[color:var(--lux-text-muted)]">{message.length}/{BUDDY_MAX_TEXT_LENGTH}</span>
        </div>
      </label>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Link className="lux-button-secondary" href="/buddy">Cancel</Link>
        <button className="lux-button-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={!isValid} type="submit">Submit Buddy request</button>
      </div>
    </form>
  );
}
