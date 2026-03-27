'use client'

import { useEffect, useRef } from 'react'
import { markdownToHtml } from '@/lib/utils'

interface Props {
  content: string
  className?: string
  autoScroll?: boolean
}

export default function StreamingOutput({ content, className, autoScroll = true }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [content, autoScroll])

  if (!content) return null

  return (
    <div className={className}>
      <div
        className="prose-dark leading-relaxed"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
      />
      <div ref={bottomRef} />
    </div>
  )
}
