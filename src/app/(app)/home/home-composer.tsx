"use client";

import { MediaComposer } from "@/components/media-composer";

type HomeComposerProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function HomeComposer({ action }: HomeComposerProps) {
  return (
    <MediaComposer
      action={action}
      allowAnonymous
      formClassName="mt-4 flex flex-col gap-3"
      placeholder="What would you like to share?"
      submitLabel="Post"
      textareaClassName="min-h-[52px]"
    />
  );
}

