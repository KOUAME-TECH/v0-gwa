/** Toggle follow / unfollow — pur et testable. */
export function nextFollowState(currentlyFollowing: boolean): "follow" | "unfollow" {
  return currentlyFollowing ? "unfollow" : "follow"
}

export function followButtonLabel(isFollowing: boolean): string {
  return isFollowing ? "Suivi" : "Suivre"
}

export function shouldShowFollowButton(viewerId: string | null | undefined, authorId: string): boolean {
  if (!viewerId) return true
  return viewerId !== authorId
}
