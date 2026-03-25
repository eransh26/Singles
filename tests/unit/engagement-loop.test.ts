import assert from "node:assert/strict";
import test from "node:test";
import { getViewerEngagementState } from "../../src/lib/engagement-loop.ts";

test("engagement state stays quiet and only shows the first-post follow-up when needed", () => {
  const pendingState = getViewerEngagementState({
    viewerPostCount: 1,
    receivedReactionCount: 0,
    receivedReplyCount: 0,
    sentReactionCount: 0,
  });

  assert.equal(pendingState.shouldShowFirstPostFollowUp, true);
  assert.equal(pendingState.activityTitle, "Responses will appear here");

  const engagedState = getViewerEngagementState({
    viewerPostCount: 1,
    receivedReactionCount: 1,
    receivedReplyCount: 0,
    sentReactionCount: 0,
  });

  assert.equal(engagedState.shouldShowFirstPostFollowUp, false);
  assert.equal(engagedState.activityTitle, "Someone noticed your post");
});
