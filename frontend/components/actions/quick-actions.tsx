"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sun,
  Calendar,
  Calculator,
  FileText,
  Globe,
  Coffee,
  Heart,
  ShoppingCart,
  Star,
  Clock,
  Brain,
  Mic,
} from "lucide-react"
import type { Message } from "@/app/page"

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  prompt: string
  category: string
  color: string
}

const quickActions: QuickAction[] = [
  {
    id: "weather",
    label: "Weather",
    icon: <Sun className="w-4 h-4" />,
    prompt: "What's the weather like today?",
    category: "daily",
    color: "from-yellow-400 to-orange-500",
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: <Calendar className="w-4 h-4" />,
    prompt: "What's on my schedule today?",
    category: "daily",
    color: "from-blue-400 to-blue-600",
  },
  {
    id: "calculate",
    label: "Calculate",
    icon: <Calculator className="w-4 h-4" />,
    prompt: "Help me with calculations",
    category: "productivity",
    color: "from-green-400 to-green-600",
  },
  {
    id: "summarize",
    label: "Summarize",
    icon: <FileText className="w-4 h-4" />,
    prompt: "Summarize this document for me",
    category: "productivity",
    color: "from-purple-400 to-purple-600",
  },
  {
    id: "translate",
    label: "Translate",
    icon: <Globe className="w-4 h-4" />,
    prompt: "Help me translate something",
    category: "productivity",
    color: "from-indigo-400 to-indigo-600",
  },
  {
    id: "recipe",
    label: "Recipe",
    icon: <Coffee className="w-4 h-4" />,
    prompt: "Suggest a recipe for dinner",
    category: "lifestyle",
    color: "from-orange-400 to-red-500",
  },
  {
    id: "workout",
    label: "Workout",
    icon: <Heart className="w-4 h-4" />,
    prompt: "Create a workout plan for me",
    category: "health",
    color: "from-red-400 to-pink-500",
  },
  {
    id: "shopping",
    label: "Shopping",
    icon: <ShoppingCart className="w-4 h-4" />,
    prompt: "Help me create a shopping list",
    category: "lifestyle",
    color: "from-teal-400 to-cyan-500",
  },
]

interface QuickActionsProps {
  onSendMessage: (prompt: string) => void
  isDarkMode: boolean
  messages: Message[]
}

export function QuickActions({ onSendMessage, isDarkMode, messages }: QuickActionsProps) {
  const currentTime = new Date()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Card
            key={action.id}
            className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl border-0 ${
              isDarkMode
                ? "bg-black/20 backdrop-blur-xl hover:bg-black/30"
                : "bg-white/70 backdrop-blur-xl hover:bg-white/90"
            }`}
            onClick={() => onSendMessage(action.prompt)}
          >
            <CardContent className="p-4 text-center">
              <div
                className={`w-12 h-12 rounded-full bg-gradient-to-r ${action.color} flex items-center justify-center mx-auto mb-3 shadow-lg`}
              >
                {action.icon}
              </div>
              <h3 className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>{action.label}</h3>
              <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>{action.category}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
            <Star className="w-5 h-5" />
            Personal Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Current Time
                </span>
              </div>
              <p className={`text-lg font-bold ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                {currentTime.toLocaleTimeString()}
              </p>
            </div>

            <div className={`p-4 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple-500" />
                <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Conversations
                </span>
              </div>
              <p className={`text-lg font-bold ${isDarkMode ? "text-purple-400" : "text-purple-600"}`}>
                {messages.length}
              </p>
            </div>

            <div className={`p-4 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-4 h-4 text-green-500" />
                <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Voice Messages
                </span>
              </div>
              <p className={`text-lg font-bold ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
                {messages.filter((m) => m.isVoice).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
