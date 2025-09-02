"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Sun, Moon, Volume2, VolumeX, Cpu, Mic, Brain, Play } from "lucide-react"
import { useEffect, useState } from "react"

interface SystemStatus {
  whisper: boolean
  gpt4: boolean
  symbolic: boolean
  taskRunner: boolean
}

interface HeaderProps {
  currentTime: Date
  isDarkMode: boolean
  isSoundEnabled: boolean
  systemStatus: SystemStatus
  onToggleDarkMode: () => void
  onToggleSound: () => void
}

export function Header({
  currentTime,
  isDarkMode,
  isSoundEnabled,
  systemStatus,
  onToggleDarkMode,
  onToggleSound,
}: HeaderProps) {
  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return "Good Morning"
    if (hour < 17) return "Good Afternoon"
    return "Good Evening"
  }
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => setHasMounted(true), [])

  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping" />
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>{getGreeting()}! 🤖</h1>
          <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
            {hasMounted ? currentTime.toLocaleDateString() : ""}
            . Symbolic AI Sandbox
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={systemStatus.whisper ? "default" : "destructive"} className="text-xs">
              <Mic className="w-3 h-3 mr-1" />
              Whisper
            </Badge>
            <Badge variant={systemStatus.gpt4 ? "default" : "destructive"} className="text-xs">
              <Brain className="w-3 h-3 mr-1" />
              GPT-4
            </Badge>
            <Badge variant={systemStatus.symbolic ? "default" : "destructive"} className="text-xs">
              <Cpu className="w-3 h-3 mr-1" />
              Symbolic
            </Badge>
            <Badge variant={systemStatus.taskRunner ? "default" : "destructive"} className="text-xs">
              <Play className="w-3 h-3 mr-1" />
              Tasks
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSound}
          className={`${isDarkMode ? "text-white hover:bg-white/10" : "text-gray-600 hover:bg-black/5"}`}
        >
          {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDarkMode}
          className={`${isDarkMode ? "text-white hover:bg-white/10" : "text-gray-600 hover:bg-black/5"}`}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}
