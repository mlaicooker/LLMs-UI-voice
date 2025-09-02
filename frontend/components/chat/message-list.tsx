"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { MessageBubble } from "./message-bubble"
import { LoadingMessage } from "./loading-message"
import { Sparkles, ChevronUp, Loader2 } from "lucide-react"
import type { Message } from "@/app/page"

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  isDarkMode: boolean
  onLoadMoreHistory?: (beforeMessageId?: string) => Promise<Message[]>
}

export function MessageList({ messages, isLoading, isDarkMode, onLoadMoreHistory }: MessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const [historyMessages, setHistoryMessages] = useState<Message[]>([])
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true)
  const [lastScrollHeight, setLastScrollHeight] = useState(0)

  // Combine history messages with current messages
  const allMessages = [...historyMessages, ...messages]

  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom()
    }
  }, [messages, isLoading])

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }

  const maintainScrollPosition = (previousScrollHeight: number) => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        const newScrollHeight = scrollContainer.scrollHeight
        const heightDifference = newScrollHeight - previousScrollHeight
        scrollContainer.scrollTop = scrollContainer.scrollTop + heightDifference
      }
    }
  }

  const handleScroll = useCallback(
    async (event: Event) => {
      const scrollContainer = event.target as HTMLElement
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer

      // Check if user scrolled to top (with small threshold)
      if (scrollTop < 100 && hasMoreHistory && !isLoadingHistory && onLoadMoreHistory) {
        setIsLoadingHistory(true)
        setShouldScrollToBottom(false)

        try {
          // Get the oldest message ID for pagination
          const oldestMessageId = historyMessages.length > 0 ? historyMessages[0].id : messages[0]?.id

          const olderMessages = await onLoadMoreHistory(oldestMessageId)

          if (olderMessages.length > 0) {
            const currentScrollHeight = scrollContainer.scrollHeight
            setLastScrollHeight(currentScrollHeight)

            setHistoryMessages((prev) => [...olderMessages, ...prev])

            // Maintain scroll position after adding messages
            setTimeout(() => {
              maintainScrollPosition(currentScrollHeight)
            }, 50)
          } else {
            // No more messages available
            setHasMoreHistory(false)
          }
        } catch (error) {
          console.error("Failed to load chat history:", error)
          // Don't disable hasMoreHistory on error, allow retry
        } finally {
          setIsLoadingHistory(false)
        }
      }

      // Check if user is near bottom to enable auto-scroll for new messages
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100
      setShouldScrollToBottom(isNearBottom)
    },
    [hasMoreHistory, isLoadingHistory, onLoadMoreHistory, historyMessages, messages],
  )

  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]")
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll)
      return () => scrollContainer.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  const loadMoreHistoryManually = async () => {
    if (!onLoadMoreHistory || isLoadingHistory || !hasMoreHistory) return

    setIsLoadingHistory(true)
    try {
      const oldestMessageId = historyMessages.length > 0 ? historyMessages[0].id : messages[0]?.id
      const olderMessages = await onLoadMoreHistory(oldestMessageId)

      if (olderMessages.length > 0) {
        const scrollContainer = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]")
        const currentScrollHeight = scrollContainer?.scrollHeight || 0

        setHistoryMessages((prev) => [...olderMessages, ...prev])

        setTimeout(() => {
          maintainScrollPosition(currentScrollHeight)
        }, 50)
      } else {
        setHasMoreHistory(false)
      }
    } catch (error) {
      console.error("Failed to load chat history:", error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
      <div className="space-y-4 min-h-0">
        {/* Load More History Button */}
        {hasMoreHistory && (
          <div className="flex justify-center">
            <Button
              onClick={loadMoreHistoryManually}
              disabled={isLoadingHistory}
              variant="outline"
              size="sm"
              className={`gap-2 ${
                isDarkMode
                  ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                  : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
              } backdrop-blur-sm`}
            >
              {isLoadingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronUp className="w-4 h-4" />}
              {isLoadingHistory ? "Loading..." : "Load older messages"}
            </Button>
          </div>
        )}

        {/* History Loading Indicator */}
        {isLoadingHistory && (
          <div className="flex justify-center py-2">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                isDarkMode ? "bg-white/10 text-white" : "bg-black/10 text-gray-700"
              } backdrop-blur-sm`}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Loading chat history...</span>
            </div>
          </div>
        )}

        {/* No More History Indicator */}
        {!hasMoreHistory && historyMessages.length > 0 && (
          <div className="flex justify-center py-2">
            <div
              className={`px-3 py-1 rounded-full text-xs ${
                isDarkMode ? "bg-white/5 text-gray-400" : "bg-black/5 text-gray-600"
              } backdrop-blur-sm`}
            >
              📚 Beginning of conversation history
            </div>
          </div>
        )}

        {/* Welcome Message for Empty Chat */}
        {allMessages.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Welcome to Your AI Assistant
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              Start a conversation by typing a message, recording your voice, or using quick actions
            </p>
          </div>
        )}

        {/* Messages */}
        {allMessages.map((message, index) => (
          <MessageBubble
            key={`${message.id}-${index}`}
            message={message}
            isDarkMode={isDarkMode}
            animationDelay={index * 50}
          />
        ))}

        {/* Current Loading Message */}
        {isLoading && <LoadingMessage isDarkMode={isDarkMode} />}

        {/* Scroll to Bottom Indicator */}
        {!shouldScrollToBottom && allMessages.length > 0 && (
          <div className="fixed bottom-24 right-8 z-10">
            <Button
              onClick={scrollToBottom}
              size="icon"
              className="rounded-full shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <ChevronUp className="w-4 h-4 rotate-180" />
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
