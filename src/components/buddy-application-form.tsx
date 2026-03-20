"use client";

import { useMemo, useState } from "react";
import { BuddyAvailabilityLevel } from "@prisma/client";

const BUDDY_MAX_TEXT_LENGTH = 3000;

type DomainOption = {
  value: string;
  label: string;
};

type RecommenderOption = {
  id: string;
  displayName: string;
};

type BuddyApplicationFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  domainOptions: DomainOption[];
  recommenderOptions: RecommenderOption[];
};

export function BuddyApplicationForm({ action, domainOptions, recommenderOptions }: BuddyApplicationFormProps) {
  const [intro, setIntro] = useState("");
  const [availabilityLevel, setAvailabilityLevel] = useState<"" | BuddyAvailabilityLevel>("");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, string[]>>({});

  const errors = useMemo(() => {
    const domainErrors: Record<string, string | null> = {};
    for (const domainId of selectedDomains) {
      const values = Array.from(new Set((recommendations[domainId] ?? []).filter(Boolean)));
      domainErrors[domainId] = values.length === 2 ? null : "Choose 2 verified connections for this domain.";
    }

    return {
      intro: intro.trim().length === 0 ? "Add a short Buddy introduction." : intro.trim().length > BUDDY_MAX_TEXT_LENGTH ? `Keep your intro under ${BUDDY_MAX_TEXT_LENGTH} characters.` : null,
      availability: availabilityLevel ? null : "Choose one.",
      domains: selectedDomains.length > 0 ? null : "Choose at least one domain.",
      domainErrors,
    };
  }, [availabilityLevel, intro, recommendations, selectedDomains]);

  const isValid = !errors.intro && !errors.availability && !errors.domains && Object.values(errors.domainErrors).every((value) => !value);

  return (
    <form action={action} className="mt-5 grid gap-4 text-sm text-[color:var(--lux-text-secondary)]">
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
          <span className={errors.intro ? "text-[color:var(--lux-danger)]" : "text-[color:var(--lux-text-muted)]"}>{errors.intro ?? "Required."}</span>
          <span className="text-[color:var(--lux-text-muted)]">{intro.length}/{BUDDY_MAX_TEXT_LENGTH}</span>
        </div>
      </label>

      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Availability level</span>
        <select className="lux-select" name="buddyAvailabilityLevel" onChange={(event) => setAvailabilityLevel(event.target.value as "" | BuddyAvailabilityLevel)} value={availabilityLevel}>
          <option value="">Choose one</option>
          {Object.values(BuddyAvailabilityLevel).map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <span className={errors.availability ? "text-xs text-[color:var(--lux-danger)]" : "text-xs text-[color:var(--lux-text-muted)]"}>{errors.availability ?? "Required."}</span>
      </label>

      <fieldset className="grid gap-3">
        <legend className="font-medium text-[color:var(--lux-text)]">Buddy domains</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {domainOptions.map((option) => {
            const checked = selectedDomains.includes(option.value);
            return (
              <label className="lux-panel flex items-center gap-3" key={option.value}>
                <input
                  checked={checked}
                  className="size-4 accent-[color:var(--lux-accent)]"
                  name="domainIds"
                  onChange={(event) => {
                    const nextChecked = event.target.checked;
                    setSelectedDomains((current) => nextChecked ? [...current, option.value] : current.filter((entry) => entry !== option.value));
                    if (!nextChecked) {
                      setRecommendations((current) => {
                        const next = { ...current };
                        delete next[option.value];
                        return next;
                      });
                    }
                  }}
                  type="checkbox"
                  value={option.value}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <span className={errors.domains ? "text-xs text-[color:var(--lux-danger)]" : "text-xs text-[color:var(--lux-text-muted)]"}>{errors.domains ?? "Choose every domain you want reviewed in this application."}</span>
      </fieldset>

      {selectedDomains.map((domainId) => {
        const domainLabel = domainOptions.find((option) => option.value === domainId)?.label ?? "Selected domain";
        const currentValues = recommendations[domainId] ?? ["", ""];
        return (
          <section className="rounded-[1.2rem] border border-[color:var(--lux-border)] bg-white p-4" key={domainId}>
            <p className="text-sm font-semibold text-[color:var(--lux-text)]">{domainLabel}</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--lux-text-muted)]">Choose 2 verified members you already know through approved chat.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {[0, 1].map((index) => (
                <label className="grid gap-2" key={`${domainId}-${index}`}>
                  <span className="font-medium text-[color:var(--lux-text)]">Recommender {index + 1}</span>
                  <select
                    className="lux-select"
                    name={`recommendation-${domainId}`}
                    onChange={(event) => {
                      setRecommendations((current) => {
                        const nextValues = [...(current[domainId] ?? ["", ""])]
                        while (nextValues.length < 2) nextValues.push("");
                        nextValues[index] = event.target.value;
                        return { ...current, [domainId]: nextValues };
                      });
                    }}
                    value={currentValues[index] ?? ""}
                  >
                    <option value="">Choose one</option>
                    {recommenderOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.displayName}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className={errors.domainErrors[domainId] ? "mt-3 text-xs text-[color:var(--lux-danger)]" : "mt-3 text-xs text-[color:var(--lux-text-muted)]"}>{errors.domainErrors[domainId] ?? "Each recommendation is private and visible to admin only."}</p>
          </section>
        );
      })}

      <div className="flex justify-end">
        <button className="lux-button-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={!isValid} type="submit">Submit Buddy application</button>
      </div>
    </form>
  );
}
