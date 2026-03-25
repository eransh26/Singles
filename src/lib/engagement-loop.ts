export type ViewerEngagementSummary = {
  viewerPostCount: number;
  receivedReactionCount: number;
  receivedReplyCount: number;
  sentReactionCount: number;
};

export type ViewerEngagementState = {
  hasFirstPost: boolean;
  hasReceivedReaction: boolean;
  hasReceivedReply: boolean;
  hasSentReaction: boolean;
  hasMeaningfulEngagement: boolean;
  shouldShowFirstPostFollowUp: boolean;
  activityTitle: string | null;
  activityBody: string | null;
};

export function getViewerEngagementState(summary: ViewerEngagementSummary): ViewerEngagementState {
  const hasFirstPost = summary.viewerPostCount > 0;
  const hasReceivedReaction = summary.receivedReactionCount > 0;
  const hasReceivedReply = summary.receivedReplyCount > 0;
  const hasSentReaction = summary.sentReactionCount > 0;
  const hasMeaningfulEngagement = hasReceivedReaction || hasReceivedReply;

  let activityTitle: string | null = null;
  let activityBody: string | null = null;

  if (hasReceivedReply) {
    activityTitle = "You have your first response";
    activityBody = "Return here to keep the conversation moving while the thread is still warm.";
  } else if (hasReceivedReaction) {
    activityTitle = "Someone noticed your post";
    activityBody = "You can return here to see who engaged and decide whether to reply.";
  } else if (hasFirstPost) {
    activityTitle = "Responses will appear here";
    activityBody = "Once someone reacts or replies, this becomes your quiet place to return to.";
  }

  return {
    hasFirstPost,
    hasReceivedReaction,
    hasReceivedReply,
    hasSentReaction,
    hasMeaningfulEngagement,
    shouldShowFirstPostFollowUp: summary.viewerPostCount === 1 && !hasMeaningfulEngagement,
    activityTitle,
    activityBody,
  };
}
