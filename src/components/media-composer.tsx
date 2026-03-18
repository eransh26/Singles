"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { EmojiPicker } from "@/components/emoji-picker";

type HiddenField = {
  name: string;
  value: string;
};

type MediaComposerProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: HiddenField[];
  placeholder: string;
  submitLabel: string;
  allowAnonymous?: boolean;
  compact?: boolean;
  textareaClassName?: string;
  formClassName?: string;
};

function isMobileCapturePreferred() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(max-width: 767px)").matches || /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
}

export function MediaComposer({
  action,
  hiddenFields = [],
  placeholder,
  submitLabel,
  allowAnonymous = false,
  compact = false,
  textareaClassName = "",
  formClassName = "",
}: MediaComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [contentText, setContentText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedCameraImage, setSelectedCameraImage] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight, compact ? 52 : 48)}px`;
  }, [compact, contentText]);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current) {
      return;
    }

    let active = true;

    async function startCamera() {
      if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera capture is not supported here. Please choose an image instead.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError("Camera access was not available. You can upload a photo instead.");
      }
    }

    startCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  function appendEmoji(emoji: string) {
    setContentText((current) => `${current}${emoji}`);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function assignFile(input: HTMLInputElement | null, file: File) {
    if (!input) {
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  }

  function clearFile(type: "image" | "camera") {
    if (type === "image") {
      setSelectedImage(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      return;
    }

    setSelectedCameraImage(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>, type: "image" | "camera") {
    const file = event.target.files?.[0] ?? null;
    if (type === "image") {
      setSelectedImage(file?.name ?? null);
    } else {
      setSelectedCameraImage(file?.name ?? null);
    }
  }

  function openCamera() {
    if (isMobileCapturePreferred()) {
      cameraInputRef.current?.click();
      return;
    }

    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    setCameraError(null);
    setCameraOpen(true);
  }

  async function captureCameraFrame() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      return;
    }

    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
    assignFile(cameraInputRef.current, file);
    setSelectedCameraImage(file.name);
    setCameraOpen(false);
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  function handleSubmit() {
    setTimeout(() => {
      setContentText("");
      clearFile("image");
      clearFile("camera");
    }, 0);
  }

  return (
    <>
      <form action={action} className={formClassName || "mt-4 flex flex-col gap-3"} onSubmit={handleSubmit}>
        {hiddenFields.map((field) => (
          <input key={field.name} name={field.name} type="hidden" value={field.value} />
        ))}

        <textarea
          ref={textareaRef}
          className={`lux-textarea overflow-hidden resize-none border-[color:var(--lux-border)] bg-white ${compact ? "min-h-[52px]" : "min-h-[48px]"} ${textareaClassName}`.trim()}
          name="contentText"
          onChange={(event) => setContentText(event.target.value)}
          placeholder={placeholder}
          required
          rows={1}
          value={contentText}
        />

        <input accept="image/*" className="hidden" name="imageAttachment" onChange={(event) => handleFileChange(event, "image")} ref={imageInputRef} type="file" />
        <input accept="image/*" capture="environment" className="hidden" name="cameraAttachment" onChange={(event) => handleFileChange(event, "camera")} ref={cameraInputRef} type="file" />

        {(selectedImage || selectedCameraImage) ? (
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-[color:var(--lux-text-muted)]">
            {selectedImage ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lux-border)] bg-white px-3 py-1.5">
                {selectedImage}
                <button onClick={() => clearFile("image")} type="button">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
            {selectedCameraImage ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--lux-border)] bg-white px-3 py-1.5">
                {selectedCameraImage}
                <button onClick={() => clearFile("camera")} type="button">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-[color:var(--lux-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[color:var(--lux-text-muted)]">
            <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--lux-border)] bg-white transition hover:border-[color:var(--lux-accent)] hover:text-[color:var(--lux-accent-deep)]" onClick={() => imageInputRef.current?.click()} title="Choose image" type="button">
              <ImagePlus className="h-4 w-4" />
            </button>
            <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--lux-border)] bg-white transition hover:border-[color:var(--lux-accent)] hover:text-[color:var(--lux-accent-deep)]" onClick={openCamera} title="Capture image" type="button">
              <Camera className="h-4 w-4" />
            </button>
            <EmojiPicker onSelect={appendEmoji} />
          </div>

          {allowAnonymous ? (
            <label className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--lux-border)] px-3 py-2 text-xs uppercase tracking-[0.14em] text-[color:var(--lux-text-secondary)]">
              <input className="size-4 accent-[color:var(--lux-accent)]" name="isAnonymous" type="checkbox" />
              Anonymous
            </label>
          ) : (
            <span className="hidden sm:block" />
          )}

          <div className="flex justify-end sm:min-w-[120px]">
            <button className={compact ? "lux-button-secondary px-4 py-2" : "lux-button-primary"} type="submit">{submitLabel}</button>
          </div>
        </div>
      </form>

      {cameraOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,43,43,0.45)] p-4">
          <div className="w-full max-w-md rounded-[1.2rem] bg-white p-4 shadow-[0_24px_60px_rgba(43,43,43,0.16)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--lux-text)]">Capture photo</p>
                <p className="text-xs text-[color:var(--lux-text-muted)]">Use your camera or close this panel to upload instead.</p>
              </div>
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--lux-border)]" onClick={closeCamera} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-[1rem] border border-[color:var(--lux-border)] bg-[color:var(--lux-secondary)]">
              {cameraError ? (
                <div className="flex min-h-[240px] items-center justify-center p-6 text-center text-sm text-[color:var(--lux-text-muted)]">{cameraError}</div>
              ) : (
                <video className="aspect-[4/3] w-full object-cover" muted playsInline ref={videoRef} />
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="lux-button-secondary" onClick={() => { closeCamera(); cameraInputRef.current?.click(); }} type="button">Upload instead</button>
              <button className="lux-button-primary" onClick={captureCameraFrame} type="button">Capture</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}



