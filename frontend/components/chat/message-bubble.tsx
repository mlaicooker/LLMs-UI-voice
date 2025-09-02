import { Badge } from "@/components/ui/badge"
import { AudioPlayer } from "./audio-player"
import { Bot, User, Mic, Cpu, GitBranch, Volume2 } from 'lucide-react'
import type { Message } from "@/app/page"

interface MessageBubbleProps {
  message: Message
  isDarkMode: boolean
  animationDelay: number
  audioUrl?: string // Add audio URL prop
}

export function MessageBubble({ message, isDarkMode, animationDelay, audioUrl }: MessageBubbleProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const getMessageIcon = () => {
    if (message.type === "system") return <Cpu className="w-4 h-4 text-purple-500" />
    if (message.type === "assistant") return <Bot className="w-4 h-4 text-white" />
    return <User className="w-4 h-4 text-white" />
  }

  const getMessageColor = () => {
    if (message.type === "system") return "from-purple-500 to-purple-600"
    if (message.type === "assistant") return "from-blue-500 to-purple-600"
    return "from-green-500 to-green-600"
  }

  return (
    <div
      className={`flex gap-3 ${message.type === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {message.type !== "user" && (
        <div
          className={`w-8 h-8 rounded-full bg-gradient-to-r ${getMessageColor()} flex items-center justify-center flex-shrink-0`}
        >
          {getMessageIcon()}
        </div>
      )}

      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 backdrop-blur-sm break-words ${
          message.type === "user"
            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
            : message.type === "system"
              ? isDarkMode
                ? "bg-purple-900/30 border border-purple-500/20 text-purple-200 shadow-lg"
                : "bg-purple-50 border border-purple-200 text-purple-800 shadow-lg"
              : isDarkMode
                ? "bg-white/10 border border-white/20 text-white shadow-lg"
                : "bg-white/80 border border-black/10 text-gray-800 shadow-lg"
        }`}
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {message.type === "user" && <User className="w-4 h-4" />}
          {message.isVoice && (
            <Badge variant="secondary" className="text-xs">
              <Mic className="w-3 h-3 mr-1" />
              Voice
            </Badge>
          )}
          {message.category && (
            <Badge variant="outline" className="text-xs">
              {message.category}
            </Badge>
          )}
          {message.confidence && (
            <Badge variant="default" className="text-xs">
              {(message.confidence * 100).toFixed(1)}%
            </Badge>
          )}
          {audioUrl && (
            <Badge variant="secondary" className="text-xs">
              <Volume2 className="w-3 h-3 mr-1" />
              Audio
            </Badge>
          )}
          <span className="text-xs opacity-70">{formatTime(message.timestamp)}</span>
        </div>

        {message.symbolPath && message.symbolPath.length > 0 && (
          <div className="flex items-center gap-1 mb-2 p-2 rounded bg-black/10">
            <GitBranch className="w-3 h-3 text-blue-400" />
            <div className="flex items-center gap-1 text-xs">
              {message.symbolPath.map((step, index) => (
                <span key={index} className="text-blue-400">
                  {step}
                  {index < message.symbolPath!.length - 1 && " → "}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

        {/* Audio Player for Assistant Messages */}
        {audioUrl && message.type === "assistant" && (
          <div className="mt-3">
            <AudioPlayer audioUrl={audioUrl} isDarkMode={isDarkMode} autoPlay={false} />
          </div>
        )}
      </div>

      {message.type === "user" && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  )
}
