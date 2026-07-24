"use client"

import { LocationMapCard } from "@/components/location/location-map-card"
import { parseLocationContent } from "@/lib/chat/location"

export function ChatLocationBubble({
  content,
  messageType,
}: {
  content: string
  messageType?: string
}) {
  void messageType
  const parsed = parseLocationContent(content)

  if (!parsed) {
    return (
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{content}</p>
    )
  }

  return (
    <div
      className="min-w-[240px] max-w-[280px] overflow-hidden rounded-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <LocationMapCard
        lat={parsed.lat}
        lon={parsed.lon}
        address={parsed.address}
        accuracy={parsed.accuracyM}
        height={150}
        className="border-0 shadow-none"
      />
    </div>
  )
}
