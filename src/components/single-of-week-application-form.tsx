"use client";

import { useMemo, useState } from "react";

const SINGLE_OF_WEEK_BIO_MAX = 300;
const SINGLE_OF_WEEK_TEXT_MAX = 300;
const SINGLE_OF_WEEK_MAX_PHOTOS = 4;

type SingleOfWeekApplicationFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  initialValues?: {
    bio?: string | null;
    interests?: string | null;
    hobbies?: string | null;
    relationshipIntent?: string | null;
    preferredLocation?: string | null;
    consented?: boolean;
  };
  disabled?: boolean;
  disabledMessage?: string | null;
};

export function SingleOfWeekApplicationForm({ action, initialValues, disabled = false, disabledMessage }: SingleOfWeekApplicationFormProps) {
  const [bio, setBio] = useState(initialValues?.bio ?? "");
  const [interests, setInterests] = useState(initialValues?.interests ?? "");
  const [hobbies, setHobbies] = useState(initialValues?.hobbies ?? "");
  const [relationshipIntent, setRelationshipIntent] = useState(initialValues?.relationshipIntent ?? "");
  const [preferredLocation, setPreferredLocation] = useState(initialValues?.preferredLocation ?? "");
  const [consented, setConsented] = useState(Boolean(initialValues?.consented));

  const canSubmit = useMemo(() => {
    return !disabled && bio.trim().length > 0 && bio.trim().length <= SINGLE_OF_WEEK_BIO_MAX && interests.length <= SINGLE_OF_WEEK_TEXT_MAX && hobbies.length <= SINGLE_OF_WEEK_TEXT_MAX && relationshipIntent.length <= SINGLE_OF_WEEK_TEXT_MAX && preferredLocation.length <= SINGLE_OF_WEEK_TEXT_MAX && consented;
  }, [bio, consented, disabled, hobbies.length, interests.length, preferredLocation.length, relationshipIntent.length]);

  return (
    <form action={action} className="grid gap-4 text-sm text-[color:var(--lux-text-secondary)]">
      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Featured bio</span>
        <textarea className="lux-textarea min-h-[120px]" disabled={disabled} maxLength={SINGLE_OF_WEEK_BIO_MAX} name="bio" onChange={(event) => setBio(event.target.value.slice(0, SINGLE_OF_WEEK_BIO_MAX))} placeholder="A calm snapshot of who you are and what you hope to find." value={bio} />
        <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--lux-text-muted)]">
          <span>Visible in the featured card.</span>
          <span>{bio.length}/{SINGLE_OF_WEEK_BIO_MAX}</span>
        </div>
      </label>

      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Interests</span>
        <input className="lux-input" disabled={disabled} maxLength={SINGLE_OF_WEEK_TEXT_MAX} name="interests" onChange={(event) => setInterests(event.target.value.slice(0, SINGLE_OF_WEEK_TEXT_MAX))} value={interests} />
        <span className="text-right text-xs text-[color:var(--lux-text-muted)]">{interests.length}/{SINGLE_OF_WEEK_TEXT_MAX}</span>
      </label>

      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Hobbies</span>
        <input className="lux-input" disabled={disabled} maxLength={SINGLE_OF_WEEK_TEXT_MAX} name="hobbies" onChange={(event) => setHobbies(event.target.value.slice(0, SINGLE_OF_WEEK_TEXT_MAX))} value={hobbies} />
        <span className="text-right text-xs text-[color:var(--lux-text-muted)]">{hobbies.length}/{SINGLE_OF_WEEK_TEXT_MAX}</span>
      </label>

      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Relationship intent</span>
        <input className="lux-input" disabled={disabled} maxLength={SINGLE_OF_WEEK_TEXT_MAX} name="relationshipIntent" onChange={(event) => setRelationshipIntent(event.target.value.slice(0, SINGLE_OF_WEEK_TEXT_MAX))} value={relationshipIntent} />
        <span className="text-right text-xs text-[color:var(--lux-text-muted)]">{relationshipIntent.length}/{SINGLE_OF_WEEK_TEXT_MAX}</span>
      </label>

      <label className="grid gap-2">
        <span className="font-medium text-[color:var(--lux-text)]">Preferred location</span>
        <input className="lux-input" disabled={disabled} maxLength={SINGLE_OF_WEEK_TEXT_MAX} name="preferredLocation" onChange={(event) => setPreferredLocation(event.target.value.slice(0, SINGLE_OF_WEEK_TEXT_MAX))} value={preferredLocation} />
        <span className="text-right text-xs text-[color:var(--lux-text-muted)]">{preferredLocation.length}/{SINGLE_OF_WEEK_TEXT_MAX}</span>
      </label>

      <fieldset className="grid gap-3">
        <legend className="font-medium text-[color:var(--lux-text)]">Featured photos</legend>
        <p className="text-xs leading-5 text-[color:var(--lux-text-muted)]">Upload up to {SINGLE_OF_WEEK_MAX_PHOTOS} photos. Manual review is required and nudity is not allowed.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: SINGLE_OF_WEEK_MAX_PHOTOS }).map((_, index) => (
            <label className="grid gap-2" key={index}>
              <span className="font-medium text-[color:var(--lux-text)]">Photo {index + 1}</span>
              <input accept="image/jpeg,image/png,image/webp,image/gif" className="lux-input file:mr-3 file:rounded-full file:border-0 file:bg-[color:var(--lux-highlight-soft)] file:px-3 file:py-2 file:text-sm file:text-[color:var(--lux-accent-deep)]" disabled={disabled} name={`photo-${index}`} type="file" />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="lux-panel flex items-start gap-3">
        <input checked={consented} className="mt-1 size-4 accent-[color:var(--lux-accent)]" disabled={disabled} name="consented" onChange={(event) => setConsented(event.target.checked)} type="checkbox" />
        <span>I consent to Evyta publishing and displaying this featured profile snapshot if I am selected.</span>
      </label>

      {disabledMessage ? <p className="text-sm text-[color:var(--lux-danger)]">{disabledMessage}</p> : null}

      <div className="flex justify-end">
        <button className="lux-button-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSubmit} type="submit">Save Single of the Week application</button>
      </div>
    </form>
  );
}
