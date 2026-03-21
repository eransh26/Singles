"use client";

import Image from "next/image";
import { Camera, ImagePlus, Loader2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const PRESET_AVATARS = [
  { value: "/avatars/avatar-female-1.svg", label: "Female 1" },
  { value: "/avatars/avatar-female-2.svg", label: "Female 2" },
  { value: "/avatars/avatar-male-1.svg", label: "Male 1" },
  { value: "/avatars/avatar-male-2.svg", label: "Male 2" },
  { value: "/avatars/avatar-neutral-1.svg", label: "Neutral 1" },
  { value: "/avatars/avatar-neutral-2.svg", label: "Neutral 2" },
] as const;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const LEGACY_ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const R2_ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Profile image upload could not be processed."));
    reader.readAsDataURL(file);
  });
}

type AvatarOptionPickerProps = {
  initialValue?: string | null;
  useR2Pipeline?: boolean;
  pendingReviewMessage?: string | null;
};

export function AvatarOptionPicker({ initialValue, useR2Pipeline = false, pendingReviewMessage }: AvatarOptionPickerProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const acceptedTypes = useR2Pipeline ? R2_ACCEPTED_TYPES : LEGACY_ACCEPTED_TYPES;
  const acceptedLabel = useR2Pipeline ? "JPG, PNG, WEBP" : "JPG, PNG, WEBP, GIF";
  const acceptValue = useR2Pipeline ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,image/gif";
  const selectedLabel = useMemo(() => PRESET_AVATARS.find((avatar) => avatar.value === value)?.label ?? null, [value]);

  function clearFileInputs() {
    if (libraryInputRef.current) libraryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!acceptedTypes.has(file.type)) {
      setError(`Profile image must be a ${acceptedLabel.replace(/, ([^,]+)$/, ", or $1")}.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Profile image must be 5 MB or smaller.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (useR2Pipeline) {
        setValue("");
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        const dataUrl = await fileToDataUrl(file);
        setPreviewUrl(null);
        setValue(dataUrl);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Profile image upload could not be processed.");
    } finally {
      setIsLoading(false);
    }
  }

  const currentSelectionLabel = selectedLabel ?? (previewUrl ? "Pending upload" : value.startsWith("data:") ? "Uploaded image" : value);
  const currentSelectionSrc = previewUrl || value;

  return (
    <div className="grid gap-3 text-sm text-[color:var(--lux-text-secondary)]">
      <div>
        <p className="font-medium text-[color:var(--lux-text)]">Profile image</p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--lux-text-muted)]">
          Paste an image URL, choose a preset avatar, upload from your device, or take a selfie where supported.
        </p>
      </div>

      <input name="image" type="hidden" value={value} />

      <input
        className="lux-input"
        onChange={(event) => {
          clearFileInputs();
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
          setValue(event.target.value);
          setError(null);
        }}
        placeholder="https://..."
        value={value.startsWith("data:") || value.startsWith("/avatars/") ? "" : value}
      />

      <div className="flex flex-wrap gap-2">
        <input
          accept={acceptValue}
          className="hidden"
          name="imageUpload"
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          ref={libraryInputRef}
          type="file"
        />
        <input
          accept={acceptValue}
          capture="user"
          className="hidden"
          name="imageCameraUpload"
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          ref={cameraInputRef}
          type="file"
        />
        <button className="lux-button-secondary" onClick={() => libraryInputRef.current?.click()} type="button">
          <Upload className="h-4 w-4" />
          Upload image
        </button>
        <button className="lux-button-secondary" onClick={() => cameraInputRef.current?.click()} type="button">
          <Camera className="h-4 w-4" />
          Take selfie
        </button>
      </div>

      {error ? <p className="text-xs text-[color:var(--lux-danger)]">{error}</p> : <p className="text-xs text-[color:var(--lux-text-muted)]">Accepted formats: {acceptedLabel}. Max 5 MB.</p>}
      {pendingReviewMessage ? <p className="text-xs text-[color:var(--lux-accent-deep)]">{pendingReviewMessage}</p> : null}

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
              onClick={() => {
                clearFileInputs();
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }
                setValue(avatar.value);
                setError(null);
              }}
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

      {currentSelectionSrc ? (
        <div className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--lux-border)] bg-white px-4 py-3">
          <span className="relative h-12 w-12 overflow-hidden rounded-full border border-[color:var(--lux-border-soft)] bg-[color:var(--lux-secondary)]">
            {isLoading ? (
              <span className="flex h-full w-full items-center justify-center text-[color:var(--lux-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /></span>
            ) : currentSelectionSrc ? (
              <Image alt={selectedLabel ?? "Selected profile image"} className="object-cover" fill sizes="48px" src={currentSelectionSrc} unoptimized />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[color:var(--lux-text-muted)]"><ImagePlus className="h-4 w-4" /></span>
            )}
          </span>
          <div>
            <p className="text-sm font-medium text-[color:var(--lux-text)]">Current selection</p>
            <p className="text-xs text-[color:var(--lux-text-muted)]">{currentSelectionLabel}</p>
            {useR2Pipeline && previewUrl ? <p className="mt-1 text-xs text-[color:var(--lux-text-muted)]">This upload will stay private until reviewed.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
