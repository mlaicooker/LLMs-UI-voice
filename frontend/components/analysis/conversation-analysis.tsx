"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  BarChart3,
  Brain,
  TrendingUp,
  Clock,
  MessageSquare,
  Mic,
  Target,
  Lightbulb,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import type { Message } from "@/app/page"

interface ConversationAnalysisProps {
  messages: Message[]
  isDarkMode: boolean
}

interface AnalysisData {
  insights: string[]
  patterns: string[]
  suggestions: string[]
  sentiment: "positive" | "neutral" | "negative"
  topics: string[]
  productivity_score: number
}

export function ConversationAnalysis({ messages, isDarkMode }: ConversationAnalysisProps) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const API_BASE = "http://192.168.104.205:3003"

  const analyzeConversation = async () => {
    if (messages.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      // Prepare conversation data for analysis
      const conversationText = messages.map((msg) => `${msg.type}: ${msg.content}`).join("\n")

      const response = await fetch(`${API_BASE}/analyze-conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation: conversationText,
          message_count: messages.length,
          voice_messages: messages.filter((m) => m.isVoice).length,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to analyze conversation")
      }

      const data = await response.json()
      setAnalysisData(data)
    } catch (error) {
      console.error("Error analyzing conversation:", error)
      setError("Failed to analyze conversation. This feature requires backend API implementation.")

      // Mock data for demonstration
      setAnalysisData({
        insights: [
          "You frequently ask about productivity and scheduling",
          "Voice messages are used 30% of the time",
          "Most conversations happen in the afternoon",
          "You prefer quick, actionable responses",
        ],
        patterns: [
          "Daily routine optimization",
          "Task management focus",
          "Voice-first interaction preference",
          "Efficiency-oriented queries",
        ],
        suggestions: [
          "Consider setting up automated daily briefings",
          "Use voice commands for quick tasks",
          "Implement recurring reminders for important tasks",
          "Create custom shortcuts for frequent requests",
        ],
        sentiment: "positive",
        topics: ["Productivity", "Scheduling", "Task Management", "Voice Commands", "Daily Planning"],
        productivity_score: 85,
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      analyzeConversation()
    }
  }, [messages.length])

  const getStats = () => {
    const totalMessages = messages.length
    const voiceMessages = messages.filter((m) => m.isVoice).length
    const userMessages = messages.filter((m) => m.type === "user").length
    const assistantMessages = messages.filter((m) => m.type === "assistant").length

    const today = new Date().toDateString()
    const todayMessages = messages.filter((m) => m.timestamp.toDateString() === today).length

    return {
      totalMessages,
      voiceMessages,
      userMessages,
      assistantMessages,
      todayMessages,
      voicePercentage: totalMessages > 0 ? Math.round((voiceMessages / totalMessages) * 100) : 0,
    }
  }

  const stats = getStats()

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                Total Messages
              </span>
            </div>
            <p className={`text-2xl font-bold ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
              {stats.totalMessages}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-green-500" />
              <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>Voice Usage</span>
            </div>
            <p className={`text-2xl font-bold ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
              {stats.voicePercentage}%
            </p>
          </CardContent>
        </Card>

        <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-500" />
              <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>Today</span>
            </div>
            <p className={`text-2xl font-bold ${isDarkMode ? "text-purple-400" : "text-purple-600"}`}>
              {stats.todayMessages}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-orange-500" />
              <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>Productivity</span>
            </div>
            <p className={`text-2xl font-bold ${isDarkMode ? "text-orange-400" : "text-orange-600"}`}>
              {analysisData?.productivity_score || 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Results */}
      <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={`flex items-center gap-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              <Brain className="w-5 h-5" />
              Conversation Analysis
            </CardTitle>
            <Button
              onClick={analyzeConversation}
              disabled={isLoading || messages.length === 0}
              size="sm"
              variant="outline"
              className={`gap-2 ${
                isDarkMode
                  ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                  : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Analyzing..." : "Refresh Analysis"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div
              className={`p-4 rounded-lg border ${
                isDarkMode ? "bg-red-900/20 border-red-500/20 text-red-300" : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Analysis Error</span>
              </div>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {analysisData && (
            <>
              {/* Topics */}
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Discussion Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysisData.topics.map((topic, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator className={isDarkMode ? "bg-white/10" : "bg-black/10"} />

              {/* Insights */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  <TrendingUp className="w-5 h-5" />
                  Key Insights
                </h3>
                <div className="space-y-2">
                  {analysisData.insights.map((insight, index) => (
                    <div key={index} className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
                      <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>• {insight}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className={isDarkMode ? "bg-white/10" : "bg-black/10"} />

              {/* Suggestions */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  <Lightbulb className="w-5 h-5" />
                  Personalized Suggestions
                </h3>
                <div className="space-y-2">
                  {analysisData.suggestions.map((suggestion, index) => (
                    <div key={index} className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
                      <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>💡 {suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className={isDarkMode ? "bg-white/10" : "bg-black/10"} />

              {/* Patterns */}
              <div>
                <h3
                  className={`text-lg font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}
                >
                  <BarChart3 className="w-5 h-5" />
                  Usage Patterns
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysisData.patterns.map((pattern, index) => (
                    <div key={index} className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
                      <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>📊 {pattern}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {messages.length === 0 && (
            <div className="text-center py-8">
              <Brain className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
              <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                No Conversations Yet
              </h3>
              <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Start chatting to see conversation analysis and insights
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
