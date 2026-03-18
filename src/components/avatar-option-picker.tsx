"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

const PRESET_AVATARS = [
  { value: "/avatars/avatar-female-1.svg", label: "Female 1" },
  { value: "/avatars/avatar-female-2.svg", label: "Female 2" },
  { value: "/avatars/avatar-male-1.svg", label: "Male 1" },
  { value: "/avatars/avatar-male-2.svg", label: "Male 2" },
  { value: "/avatars/avatar-neutral-1.svg", label: "Neutral 1" },
  { value: "/avatars/avatar-neutral-2.svg", label: "Neutral 2" },
] as const;

export function AvatarOptionPicker({ initialValue }: { initialValue?: string | null }) {
  const [value, setValue] = useState(initialValue ?? "");
  const selectedLabel = useMemo(
    () => PRESET_AVATARS.find((avatar) => avatar.value === value)?.label ?? null,
    [value],
  );

  return (
    <div className="grid gap-3 text-sm text-[color:var(--lux-text-secondary)]">
      <div>
        <p className="font-medium text-[color:var(--lux-text)]">Profile image</p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--lux-text-muted)]">
          Paste an image URL or pick one of the preset Evyta avatars below.
        </p>
      </div>

      <input
        className="lux-input"
        name="image"
        onChange={(event) => setValue(event.target.value)}
        placeholder="https://..."
        value={value}
      />

      <div className="grid grid-cols-3 gap-3">
        {PRESET_AVATARS.map((avatar) => {
          const isSelected = value === avatar.value;
          return (
            <button
              className={`flex flex-col items-center gap-2 rounded-[1rem] border bg-white px-3 py-3 text-xs font-medium transition ${
                isSelected
                  ? "border-[color:var(--lux-accent)] shadow-[0_10px_24px_rgba(124,74,110,0.12)]"
                  : "border-[color:var(--lux-border)] hover:border-[color:var(--lux-accent-border)]"
              }`}
              key={avatar.value}
              onClick={() => setValue(avatar.value)}
              type="button"
            >
              <span className="relative h-14 w-14 overflow-hidden rounded-full border border-[color:var(--lux-border-soft)] bg-[color:var(--lux-secondary)]">
                <Image alt={avatar.label} className="object-cover" fill sizes="56px" src={avatar.value} unoptimized />
              </span>
              <span className="text-[color:var(--lux-text-secondary)]">{avatar.label}</span>
            </button>
          );
        })}
      </div>

      {value ? (
        <div className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--lux-border)] bg-white px-4 py-3">
          <span className="relative h-12 w-12 overflow-hidden rounded-full border border-[color:var(--lux-border-soft)] bg-[color:var(--lux-secondary)]">
            <Image alt={selectedLabel ?? "Selected profile image"} className="object-cover" fill sizes="48px" src={value} unoptimized />
          </span>
          <div>
            <p className="text-sm font-medium text-[color:var(--lux-text)]">Current selection</p>
            <p className="text-xs text-[color:var(--lux-text-muted)]">{selectedLabel ?? value}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
