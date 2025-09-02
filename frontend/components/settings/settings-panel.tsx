"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Sun, Moon, Volume2, VolumeX, Cpu, Mic, Brain, Play, RefreshCw } from "lucide-react"

interface SystemStatus {
  whisper: boolean
  gpt4: boolean
  symbolic: boolean
  taskRunner: boolean
}

interface SettingsPanelProps {
  isDarkMode: boolean
  isSoundEnabled: boolean
  systemStatus: SystemStatus
  onToggleDarkMode: () => void
  onToggleSound: () => void
}

export function SettingsPanel({
  isDarkMode,
  isSoundEnabled,
  systemStatus,
  onToggleDarkMode,
  onToggleSound,
}: SettingsPanelProps) {
  const API_BASE = "http://192.168.104.205:3003"

  const restartSystem = async () => {
    try {
      await fetch(`${API_BASE}/system/restart`, { method: "POST" })
    } catch (error) {
      console.error("Failed to restart system:", error)
    }
  }

  return (
    <div className="space-y-6">
      <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
        <CardHeader>
          <CardTitle className={`${isDarkMode ? "text-white" : "text-gray-800"}`}>System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-4 h-4" />
                <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Whisper STT
                </span>
                <Badge variant={systemStatus.whisper ? "default" : "destructive"} className="text-xs">
                  {systemStatus.whisper ? "Online" : "Offline"}
                </Badge>
              </div>
              <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Speech-to-text processing</p>
            </div>

            <div className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4" />
                <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>GPT-4 LLM</span>
                <Badge variant={systemStatus.gpt4 ? "default" : "destructive"} className="text-xs">
                  {systemStatus.gpt4 ? "Ready" : "Loading"}
                </Badge>
              </div>
              <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Language model inference</p>
            </div>

            <div className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4" />
                <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Symbolic Engine
                </span>
                <Badge variant={systemStatus.symbolic ? "default" : "destructive"} className="text-xs">
                  {systemStatus.symbolic ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Intent routing & triggers</p>
            </div>

            <div className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Play className="w-4 h-4" />
                <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Task Runner
                </span>
                <Badge variant={systemStatus.taskRunner ? "default" : "destructive"} className="text-xs">
                  {systemStatus.taskRunner ? "Running" : "Stopped"}
                </Badge>
              </div>
              <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Command execution shell</p>
            </div>
          </div>

          <Button onClick={restartSystem} className="w-full bg-gradient-to-r from-orange-500 to-red-600">
            <RefreshCw className="w-4 h-4 mr-2" />
            Restart System Components
          </Button>
        </CardContent>
      </Card>

      <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
        <CardHeader>
          <CardTitle className={`${isDarkMode ? "text-white" : "text-gray-800"}`}>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>Dark Mode</h3>
              <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Toggle dark/light theme</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleDarkMode}
              className={`${
                isDarkMode
                  ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                  : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>

          <Separator className={isDarkMode ? "bg-white/10" : "bg-black/10"} />

          <div className="flex items-center justify-between">
            <div>
              <h3 className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>Sound Effects</h3>
              <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Enable audio feedback</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleSound}
              className={`${
                isDarkMode
                  ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                  : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
              }`}
            >
              {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>

          <Separator className={isDarkMode ? "bg-white/10" : "bg-black/10"} />

          <div>
            <h3 className={`font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>System Information</h3>
            <div className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
              <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Backend: {API_BASE}</p>
              <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                Framework: Symbolic AI Sandbox
              </p>
              <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Version: 1.0.0</p>
              <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                Project Structure: core/agents/, core/symbols/, core/intents/
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
