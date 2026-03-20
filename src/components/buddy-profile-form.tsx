"use client";

import { useMemo, useState } from "react";
import { BuddyAvailabilityLevel } from "@prisma/client";

const BUDDY_MAX_TEXT_LENGTH = 3000;

type BuddyProfileFormProps = {
  initialIsAvailable: boolean;
  initialIntro: string;
  initialAvailabilityLevel: BuddyAvailabilityLevel | "";
  approvedDomains: string[];
  action: (formData: FormData) => void | Promise<void>;
};

export function BuddyProfileForm({
  initialIsAvailable,
  initialIntro,
  initialAvailabilityLevel,
  approvedDomains,
  action,
}: BuddyProfileFormProps) {
  const [isAvailable, setIsAvailable] = useState(initialIsAvailable);
  const [intro, setIntro] = useState(initialIntro);
  const [availabilityLevel, setAvailabilityLevel] = useState(initialAvailabilityLevel);

  const errors = useMemo(() => {
    if (!isAvailable) {
      return { intro: null, availability: null, domains: null } as const;
    }

    return {
      intro: intro.trim().length === 0 ? "Add a short Buddy introduction." : intro.trim().length > BUDDY_MAX_TEXT_LENGTH ? `Keep your intro under ${BUDDY_MAX_TEXT_LENGTH} characters.` : null,
      availability: availabilityLevel ? null : "Choose your availability level.",
      domains: approvedDomains.length > 0 ? null : "You need at least one approved Buddy domain before becoming available.",
    } as const;
  }, [approvedDomains.length, availabilityLevel, intro, isAvailable]);

  const isValid = !errors.intro && !errors.availability && !errors.domains;

  return (
    <form action={action} className="mt-5 grid gap-4 text-sm text-[color:var(--lux-text-secondary)]">
      <label className="lux-panel flex items-center gap-3">
        <input
          checked={isAvailable}
          className="size-4 accent-[color:var(--lux-accent)]"
          name="isBuddyAvailable"
          onChange={(event) => setIsAvailable(event.target.checked)}
          type="checkbox"
        />
        <span>Make me available as a Buddy</span>
      </label>
      <div className="rounded-[1.1rem] border border-[color:var(--lux-border)] bg-white p-4">
        <p className="font-medium text-[color:var(--lux-text)]">Approved domains</p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {approvedDomains.length > 0 ? approvedDomains.map((domain) => (
            <span className="lux-chip lux-chip-accent" key={domain}>{domain}</span>
          )) : <span className="text-sm text-[color:var(--lux-text-muted)]">No approved Buddy domains yet.</span>}
        </div>
        <p className={errors.domains ? "mt-3 text-xs text-[color:var(--lux-danger)]" : "mt-3 text-xs text-[color:var(--lux-text-muted)]"}>{errors.domains ?? "Availability only applies to approved domains."}</p>
      </div>
      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Short Buddy intro</span>
        <textarea
          className="lux-textarea min-h-[120px]"
          maxLength={BUDDY_MAX_TEXT_LENGTH}
          name="buddyIntro"
          onChange={(event) => setIntro(event.target.value.slice(0, BUDDY_MAX_TEXT_LENGTH))}
          placeholder="A calm introduction to the kind of support you can offer."
          value={intro}
        />
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className={errors.intro ? "text-[color:var(--lux-danger)]" : "text-[color:var(--lux-text-muted)]"}>{errors.intro ?? "Required when you make yourself available."}</span>
          <span className="text-[color:var(--lux-text-muted)]">{intro.length}/{BUDDY_MAX_TEXT_LENGTH}</span>
        </div>
      </label>
      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Availability level</span>
        <select
          className="lux-select"
          name="buddyAvailabilityLevel"
          onChange={(event) => setAvailabilityLevel(event.target.value as BuddyAvailabilityLevel | "")}
          value={availabilityLevel}
        >
          <option value="">Choose one</option>
          {Object.values(BuddyAvailabilityLevel).map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <span className={errors.availability ? "text-xs text-[color:var(--lux-danger)]" : "text-xs text-[color:var(--lux-text-muted)]"}>{errors.availability ?? "Required when available."}</span>
      </label>
      <div className="flex justify-end">
        <button className="lux-button-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={isAvailable && !isValid} type="submit">Save Buddy profile</button>
      </div>
    </form>
  );
}
