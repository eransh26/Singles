"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DisconnectButton, LiveKitRoom, RoomAudioRenderer, VideoConference, useConnectionState, useRemoteParticipants } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

type VideoRoomClientProps = {
  conversationId: string;
  otherUserName: string;
};

type TokenState = {
  token: string;
  roomName: string;
  callRecordId: string;
  callMode: "start" | "join";
  livekitUrl: string;
};

function getTokenErrorMessage(status: number, fallback?: string) {
  if (status === 401) return "Please sign in again before starting the video call.";
  if (status === 403) return "This private room is only available to the approved chat participants.";
  if (status === 404) return "This private conversation could not be found.";
  if (status === 503) return "Video calling is temporarily unavailable right now.";
  return fallback ?? "Unable to start the video call.";
}

function VideoRoomStatusBanner({ connectionError }: { connectionError: string | null }) {
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();

  let text: string | null = null;
  let tone = "text-[color:var(--lux-text-secondary)]";

  if (connectionError) {
    text = connectionError;
    tone = "text-[color:var(--lux-danger)]";
  } else if (connectionState === ConnectionState.Connecting) {
    text = "Connecting to the private room...";
  } else if (connectionState === ConnectionState.Reconnecting) {
    text = "Reconnecting your private call...";
  } else if (connectionState === ConnectionState.Connected && remoteParticipants.length === 0) {
    text = "Waiting for the other participant to join...";
  } else if (connectionState === ConnectionState.Disconnected) {
    text = "Disconnected from the private room.";
  }

  if (!text) {
    return null;
  }

  return (
    <div className={`border-b border-[color:var(--lux-border)] bg-[rgba(18,19,24,0.9)] px-4 py-3 text-sm backdrop-blur-sm md:px-5 ${tone}`}>
      {text}
    </div>
  );
}

export function VideoRoomClient({ conversationId, otherUserName }: VideoRoomClientProps) {
  const router = useRouter();
  const [tokenState, setTokenState] = useState<TokenState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const leaveHandledRef = useRef(false);

  useEffect(() => {
    leaveHandledRef.current = false;
    let cancelled = false;

    async function loadToken() {
      setLoading(true);
      setError(null);
      setDeviceError(null);
      setConnectionError(null);
      setLeaveError(null);

      try {
        const response = await fetch("/api/video/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(getTokenErrorMessage(response.status, payload?.error));
        }

        const payload = (await response.json()) as TokenState;
        if (!cancelled) {
          setTokenState(payload);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to start the video call.");
          setTokenState(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadToken();
    return () => {
      cancelled = true;
    };
  }, [attempt, conversationId]);

  async function handleLeave() {
    if (leaveHandledRef.current || !tokenState) {
      router.push(`/chats/${conversationId}`);
      return;
    }

    leaveHandledRef.current = true;
    setLeaveError(null);

    try {
      const response = await fetch("/api/video/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, callRecordId: tokenState.callRecordId }),
      });

      if (!response.ok) {
        setLeaveError("The call ended, but we could not fully close the room record. Returning to chat...");
      }
    } catch {
      setLeaveError("The call ended, but we could not fully close the room record. Returning to chat...");
    } finally {
      router.push(`/chats/${conversationId}`);
    }
  }

  const helpText = useMemo(() => leaveError ?? deviceError ?? error, [deviceError, error, leaveError]);

  if (loading) {
    return (
      <section className="lux-card">
        <p className="lux-overline">Private video room</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Requesting access</h2>
        <p className="mt-3 text-sm leading-7 text-[color:var(--lux-text-secondary)]">Preparing a secure video room with {otherUserName}.</p>
      </section>
    );
  }

  if (!tokenState) {
    return (
      <section className="lux-card">
        <p className="lux-overline">Private video room</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--lux-text)]">Could not connect</h2>
        <p className="mt-3 text-sm leading-7 text-[color:var(--lux-text-secondary)]">{helpText ?? "This call could not be started."}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="lux-button-primary" onClick={() => setAttempt((value) => value + 1)} type="button">Retry</button>
          <button className="lux-button-secondary" onClick={() => router.push(`/chats/${conversationId}`)} type="button">Back to chat</button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4" data-lk-theme="default">
      {helpText ? (
        <div className="rounded-[0.9rem] border border-[color:rgba(138,89,100,0.18)] bg-[color:rgba(138,89,100,0.08)] px-4 py-3 text-sm text-[color:var(--lux-danger)]">
          {helpText}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-[1rem] border border-[color:var(--lux-border)] bg-[rgba(18,19,24,0.92)] shadow-[0_12px_28px_rgba(43,43,43,0.06)]">
        <LiveKitRoom
          audio
          className="block"
          connect
          data-lk-theme="default"
          onConnected={() => {
            setConnectionError(null);
            setDeviceError(null);
          }}
          onDisconnected={() => void handleLeave()}
          onError={(liveKitError) => setConnectionError(liveKitError?.message || "The room could not be joined right now.")}
          onMediaDeviceFailure={() => setDeviceError("Camera or microphone access was denied. Please check your device permissions and retry.")}
          serverUrl={tokenState.livekitUrl}
          token={tokenState.token}
          video
        >
          <div className="flex min-h-[60vh] flex-col md:min-h-[72vh]">
            <div className="border-b border-[color:var(--lux-border)] bg-[rgba(255,255,255,0.04)] px-4 py-4 backdrop-blur-sm md:px-5">
              <p className="lux-overline">{tokenState.callMode === "join" ? "Joinable private call" : "Private video room"}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-[color:var(--lux-text)] md:text-xl">Live call with {otherUserName}</h2>
                <DisconnectButton className="lux-button-secondary shrink-0" onClick={() => void handleLeave()}>Leave call</DisconnectButton>
              </div>
            </div>
            <VideoRoomStatusBanner connectionError={connectionError} />
            <div className="flex-1 overflow-hidden p-2 md:p-4">
              <div className="h-full min-h-[46vh] overflow-hidden rounded-[0.95rem] bg-[rgba(255,255,255,0.04)]">
                <VideoConference />
              </div>
            </div>
            <RoomAudioRenderer />
          </div>
        </LiveKitRoom>
      </div>
    </div>
  );
}

