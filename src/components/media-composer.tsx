"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { EmojiPicker } from "@/components/emoji-picker";
import { PREMIUM_ACTION, PREMIUM_ACTION_ACCENT, PREMIUM_BODY, PREMIUM_CHIP, PREMIUM_COMPOSER_SHELL, PREMIUM_INPUT_SHELL, PREMIUM_TOOL_CHIP } from "@/components/ui/premium-styles";
import { useDismissibleLayer } from "@/components/ui/use-dismissible-layer";

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
  allowSensitive?: boolean;
  tone?: "light" | "dark";
  autoFocus?: boolean;
  promptSuggestions?: string[];
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
  allowSensitive = false,
  tone = "light",
  autoFocus = false,
  promptSuggestions = [],
}: MediaComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const cameraTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cameraCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const cameraPanelRef = useRef<HTMLDivElement | null>(null);
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
    textarea.style.height = `${Math.max(textarea.scrollHeight, compact ? 44 : 48)}px`;
  }, [compact, contentText]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [autoFocus]);

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

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  useDismissibleLayer({
    open: cameraOpen,
    onDismiss: closeCamera,
    refs: [cameraPanelRef],
    restoreFocusRef: cameraTriggerRef,
    lockScroll: true,
  });

  useEffect(() => {
    if (cameraOpen) {
      requestAnimationFrame(() => cameraCloseButtonRef.current?.focus());
    }
  }, [cameraOpen]);

  function appendEmoji(emoji: string) {
    setContentText((current) => `${current}${emoji}`);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function applySuggestion(suggestion: string) {
    setContentText(suggestion);
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

  function handleSubmit() {
    setTimeout(() => {
      setContentText("");
      clearFile("image");
      clearFile("camera");
      textareaRef.current?.focus();
    }, 0);
  }

  const darkTone = tone === "dark";
  const inputToneClass = darkTone
    ? "border-transparent bg-[rgba(255,255,255,0.018)] text-white/88 placeholder:text-white/26"
    : "border-[color:var(--lux-border)] bg-white text-[color:var(--lux-text)] placeholder:text-[color:var(--lux-text-muted)]";
  const selectedFileChip = darkTone
    ? `${PREMIUM_CHIP} normal-case tracking-[0.04em] bg-[rgba(255,255,255,0.03)]`
    : "inline-flex items-center gap-2 rounded-full border border-[color:var(--lux-border)] bg-white px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[color:var(--lux-text-muted)]";
  const dividerClass = darkTone ? "border-[rgba(255,255,255,0.08)]" : "border-[color:var(--lux-border)]";
  const iconButtonClass = darkTone ? PREMIUM_TOOL_CHIP : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--lux-border)] bg-white transition hover:border-[color:var(--lux-accent)] hover:text-[color:var(--lux-accent-deep)]";
  const toggleChipClass = darkTone
    ? `${PREMIUM_CHIP} gap-3 py-2 normal-case tracking-[0.04em] text-[color:var(--lux-text-secondary)]`
    : "inline-flex items-center justify-center gap-2.5 rounded-full border border-[color:var(--lux-border)] px-3 py-2 text-xs text-[color:var(--lux-text-secondary)]";
  const submitClass = darkTone ? PREMIUM_ACTION_ACCENT : compact ? "lux-button-secondary px-4 py-2" : "lux-button-primary";

  return (
    <>
      <form action={action} className={formClassName || "mt-4 flex flex-col gap-3"} onSubmit={handleSubmit}>
        {hiddenFields.map((field) => (
          <input key={field.name} name={field.name} type="hidden" value={field.value} />
        ))}

        <div className={PREMIUM_INPUT_SHELL}>
          <textarea
            autoFocus={autoFocus}
            ref={textareaRef}
            className={`w-full resize-none bg-transparent text-[15px] leading-[1.65] outline-none ${compact ? "min-h-[42px]" : "min-h-[46px]"} ${inputToneClass} ${textareaClassName}`.trim()}
            name="contentText"
            onChange={(event) => setContentText(event.target.value)}
            placeholder={placeholder}
            required
            rows={1}
            value={contentText}
          />
        </div>

        {promptSuggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2" data-testid="media-composer-suggestions">
            {promptSuggestions.map((suggestion, index) => (
              <button
                className={PREMIUM_CHIP}
                data-testid={`media-composer-suggestion-${index}`}
                key={suggestion}
                onClick={() => applySuggestion(suggestion)}
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <input accept="image/*" className="hidden" name="imageAttachment" onChange={(event) => handleFileChange(event, "image")} ref={imageInputRef} type="file" />
        <input accept="image/*" capture="environment" className="hidden" name="cameraAttachment" onChange={(event) => handleFileChange(event, "camera")} ref={cameraInputRef} type="file" />

        {(selectedImage || selectedCameraImage) ? (
          <div className="flex flex-wrap gap-2">
            {selectedImage ? (
              <span className={selectedFileChip}>
                {selectedImage}
                <button onClick={() => clearFile("image")} type="button">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
            {selectedCameraImage ? (
              <span className={selectedFileChip}>
                {selectedCameraImage}
                <button onClick={() => clearFile("camera")} type="button">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className={`flex flex-col gap-3 border-t pt-2.5 sm:flex-row sm:items-center sm:justify-between ${dividerClass}`}>
          <div className="flex items-center gap-2 text-white/48">
            <button className={iconButtonClass} onClick={() => imageInputRef.current?.click()} title="Choose image" type="button">
              <ImagePlus className="h-4 w-4" />
            </button>
            <button className={iconButtonClass} onClick={openCamera} ref={cameraTriggerRef} title="Capture image" type="button">
              <Camera className="h-4 w-4" />
            </button>
            <EmojiPicker onSelect={appendEmoji} />
          </div>

          {allowAnonymous || allowSensitive ? (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {allowAnonymous ? (
                <label className={toggleChipClass}>
                  <input className="size-4 shrink-0 accent-[color:var(--lux-accent)]" name="isAnonymous" type="checkbox" />
                  Anonymous
                </label>
              ) : null}
              {allowSensitive ? (
                <label className={toggleChipClass}>
                  <input className="size-4 shrink-0 accent-[color:var(--lux-accent)]" name="isSensitive" type="checkbox" />
                  Sensitive image
                </label>
              ) : null}
            </div>
          ) : (
            <span className="hidden sm:block" />
          )}

          <div className="flex justify-end sm:min-w-[120px]">
            <button className={submitClass} type="submit">{submitLabel}</button>
          </div>
        </div>
      </form>

      {cameraOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(7,8,10,0.52)] p-4">
          <div className={`w-full max-w-md p-4 ${darkTone ? PREMIUM_COMPOSER_SHELL : PREMIUM_COMPOSER_SHELL.replace('bg-[rgba(18,19,24,0.88)] text-white', 'bg-white text-[color:var(--lux-text)]')}`} data-testid="media-camera-panel" ref={cameraPanelRef}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Capture photo</p>
                <p className={`${PREMIUM_BODY} text-sm ${darkTone ? 'text-white/52' : 'text-[color:var(--lux-text-muted)]'}`}>Use your camera here, or close this panel and add an image another way.</p>
              </div>
              <button aria-label="Close camera panel" className={darkTone ? PREMIUM_TOOL_CHIP : PREMIUM_ACTION} onClick={closeCamera} ref={cameraCloseButtonRef} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className={`mt-4 overflow-hidden rounded-[1rem] border ${darkTone ? 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]' : 'border-[color:var(--lux-border)] bg-[color:var(--lux-secondary)]'}`}>
              {cameraError ? (
                <div className={`flex min-h-[240px] items-center justify-center p-6 text-center ${PREMIUM_BODY}`}>{cameraError}</div>
              ) : (
                <video className="aspect-[4/3] w-full object-cover" muted playsInline ref={videoRef} />
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={darkTone ? PREMIUM_ACTION : 'lux-button-secondary'} onClick={() => { closeCamera(); cameraInputRef.current?.click(); }} type="button">Upload instead</button>
              <button className={darkTone ? PREMIUM_ACTION_ACCENT : 'lux-button-primary'} onClick={captureCameraFrame} type="button">Capture</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


