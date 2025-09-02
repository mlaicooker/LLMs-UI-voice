"use client"
import { useState, useEffect } from "react"
import { ChatInterface } from "@/components/chat/chat-interface"
import { QuickActions } from "@/components/actions/quick-actions"
import { SettingsPanel } from "@/components/settings/settings-panel"
import { ConversationAnalysis } from "@/components/analysis/conversation-analysis"
import { BaselineAgent } from "@/components/validation/baseline-agent"
import { Header } from "@/components/layout/header"
import { ParticleBackground } from "@/components/ui/particle-background"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bot, Zap, Settings, BarChart3, Cpu, Play, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export interface Message {
  id: string
  type: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  isVoice?: boolean
  category?: string
  symbolPath?: string[]
  confidence?: number
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)
  const [activeTab, setActiveTab] = useState("validation")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [systemStatus, setSystemStatus] = useState({
    whisper: false,
    gpt4: false,
    symbolic: false,
    taskRunner: false,
  })

  const { toast } = useToast()

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Initialize system components
  useEffect(() => {
    initializeSystem()
  }, [])

  const initializeSystem = async () => {
    try {
      // Check system components
      const response = await fetch("http://192.168.104.205:3003/system/status")
      if (response.ok) {
        const status = await response.json()
        setSystemStatus(status)
      }
    } catch (error) {
      console.error("System initialization error:", error)
    }

    // Add baseline validation message
    if (messages.length === 0) {
      setTimeout(() => {
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          type: "system",
          content:
            "🔧 BASELINE AGENT VALIDATION MODE - All symbolic layers disabled. Running JSON parsing and execution mode v0 validation tests.",
          timestamp: new Date(),
        }
        setMessages([welcomeMessage])
      }, 1000)
    }
  }

  const addMessage = (
    type: "user" | "assistant" | "system",
    content: string,
    isVoice = false,
    category?: string,
    symbolPath?: string[],
    confidence?: number,
  ) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      isVoice,
      category,
      symbolPath,
      confidence,
    }
    setMessages((prev) => [...prev, newMessage])
  }

  return (
    <div
      className={`min-h-screen transition-all duration-500 ${
        isDarkMode
          ? "bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      }`}
    >
      <ParticleBackground />

      <div className="max-w-7xl mx-auto p-4">
        <Header
          currentTime={currentTime}
          isDarkMode={isDarkMode}
          isSoundEnabled={isSoundEnabled}
          systemStatus={systemStatus}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onToggleSound={() => setIsSoundEnabled(!isSoundEnabled)}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className={`grid w-full grid-cols-7 mb-6 ${
              isDarkMode ? "bg-black/20 border-white/10" : "bg-white/50 border-black/10"
            } backdrop-blur-sm border`}
          >
            <TabsTrigger value="validation" className="gap-2">
              <Shield className="w-4 h-4" />
              Validation
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <Bot className="w-4 h-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="symbolic" className="gap-2" disabled>
              <Cpu className="w-4 h-4" />
              Symbolic
            </TabsTrigger>
            <TabsTrigger value="runner" className="gap-2" disabled>
              <Play className="w-4 h-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2">
              <Zap className="w-4 h-4" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validation">
            <BaselineAgent messages={messages} onAddMessage={addMessage} isDarkMode={isDarkMode} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatInterface
              messages={messages}
              onAddMessage={addMessage}
              isDarkMode={isDarkMode}
              isSoundEnabled={isSoundEnabled}
            />
          </TabsContent>

          <TabsContent value="symbolic">
            <div className="text-center py-12">
              <Shield className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                Symbolic Layer Disabled
              </h3>
              <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Complete baseline validation tests before enabling symbolic features
              </p>
            </div>
          </TabsContent>

          <TabsContent value="runner">
            <div className="text-center py-12">
              <Shield className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                Task Runner Disabled
              </h3>
              <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                Complete baseline validation tests before enabling task execution
              </p>
            </div>
          </TabsContent>

          <TabsContent value="actions">
            <QuickActions
              onSendMessage={(prompt) => addMessage("user", prompt)}
              isDarkMode={isDarkMode}
              messages={messages}
            />
          </TabsContent>

          <TabsContent value="analysis">
            <ConversationAnalysis messages={messages} isDarkMode={isDarkMode} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsPanel
              isDarkMode={isDarkMode}
              isSoundEnabled={isSoundEnabled}
              systemStatus={systemStatus}
              onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
              onToggleSound={() => setIsSoundEnabled(!isSoundEnabled)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
