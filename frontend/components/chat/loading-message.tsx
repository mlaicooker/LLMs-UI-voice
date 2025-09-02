import { Bot, Loader2 } from "lucide-react"

interface LoadingMessageProps {
  isDarkMode: boolean
}

export function LoadingMessage({ isDarkMode }: LoadingMessageProps) {
  return (
    <div className="flex gap-3 justify-start animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div
        className={`backdrop-blur-sm rounded-2xl px-4 py-3 ${
          isDarkMode ? "bg-white/10 border border-white/20" : "bg-white/80 border border-black/10"
        }`}
      >
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Thinking...</span>
        </div>
      </div>
    </div>
  )
}
