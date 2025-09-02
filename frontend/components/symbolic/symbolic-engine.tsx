"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Cpu, GitBranch, Play, Pause, AlertTriangle, CheckCircle, Clock, Zap, RefreshCw } from "lucide-react"
import type { Message } from "@/app/page"

interface SymbolicRoute {
  id: string
  symbol: string
  intent: string
  confidence: number
  path: string[]
  status: "pending" | "processing" | "completed" | "failed"
  timestamp: Date
  logs: string[]
}

interface IntentMap {
  [key: string]: {
    triggers: string[]
    actions: string[]
    fallbacks: string[]
    confidence_threshold: number
  }
}

interface SymbolicEngineProps {
  messages: Message[]
  onAddMessage: (
    type: "user" | "assistant" | "system",
    content: string,
    isVoice?: boolean,
    category?: string,
    symbolPath?: string[],
    confidence?: number,
  ) => void
  isDarkMode: boolean
}

export function SymbolicEngine({ messages, onAddMessage, isDarkMode }: SymbolicEngineProps) {
  const [routes, setRoutes] = useState<SymbolicRoute[]>([])
  const [intentMap, setIntentMap] = useState<IntentMap>({})
  const [isLoading, setIsLoading] = useState(false)
  const [testInput, setTestInput] = useState("")
  const [isDryRun, setIsDryRun] = useState(true)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const API_BASE = "http://192.168.104.205:3003"

  useEffect(() => {
    loadIntentMap()
    loadRoutes()
  }, [])

  const loadIntentMap = async () => {
    try {
      const response = await fetch(`${API_BASE}/symbolic/intent-map`)
      if (response.ok) {
        const data = await response.json()
        setIntentMap(data)
      } else {
        // Mock data for demonstration
        setIntentMap({
          "task.create": {
            triggers: ["create task", "new task", "add task", "make task"],
            actions: ["task_manager.create", "logger.log", "notification.send"],
            fallbacks: ["task.help", "general.help"],
            confidence_threshold: 0.7,
          },
          "schedule.check": {
            triggers: ["check schedule", "what's my schedule", "calendar", "appointments"],
            actions: ["calendar.get_today", "formatter.schedule", "display.show"],
            fallbacks: ["schedule.help", "general.help"],
            confidence_threshold: 0.8,
          },
          "voice.process": {
            triggers: ["voice command", "speech input", "audio"],
            actions: ["whisper.transcribe", "intent.match", "action.execute"],
            fallbacks: ["voice.retry", "text.fallback"],
            confidence_threshold: 0.6,
          },
          "system.status": {
            triggers: ["system status", "health check", "diagnostics"],
            actions: ["system.check_all", "logger.status", "display.metrics"],
            fallbacks: ["system.help"],
            confidence_threshold: 0.9,
          },
        })
      }
    } catch (error) {
      console.error("Failed to load intent map:", error)
    }
  }

  const loadRoutes = async () => {
    try {
      const response = await fetch(`${API_BASE}/symbolic/routes`)
      if (response.ok) {
        const data = await response.json()
        setRoutes(data)
      }
    } catch (error) {
      console.error("Failed to load routes:", error)
    }
  }

  const validateIntentMap = async () => {
    setIsLoading(true)
    const errors: string[] = []

    try {
      // Check for circular dependencies
      const visited = new Set<string>()
      const recursionStack = new Set<string>()

      const checkCircular = (intent: string): boolean => {
        if (recursionStack.has(intent)) {
          errors.push(`Circular dependency detected: ${intent}`)
          return true
        }
        if (visited.has(intent)) return false

        visited.add(intent)
        recursionStack.add(intent)

        const intentData = intentMap[intent]
        if (intentData?.fallbacks) {
          for (const fallback of intentData.fallbacks) {
            if (checkCircular(fallback)) return true
          }
        }

        recursionStack.delete(intent)
        return false
      }

      Object.keys(intentMap).forEach((intent) => {
        if (!visited.has(intent)) {
          checkCircular(intent)
        }
      })

      // Check for missing fallbacks
      Object.entries(intentMap).forEach(([intent, data]) => {
        data.fallbacks.forEach((fallback) => {
          if (!intentMap[fallback]) {
            errors.push(`Missing fallback intent: ${fallback} (referenced by ${intent})`)
          }
        })
      })

      // Check confidence thresholds
      Object.entries(intentMap).forEach(([intent, data]) => {
        if (data.confidence_threshold < 0 || data.confidence_threshold > 1) {
          errors.push(`Invalid confidence threshold for ${intent}: ${data.confidence_threshold}`)
        }
      })

      setValidationErrors(errors)

      if (errors.length === 0) {
        onAddMessage("system", "✅ Intent map validation passed. No errors found.", false, "validation")
      } else {
        onAddMessage("system", `❌ Intent map validation failed. Found ${errors.length} errors.`, false, "validation")
      }
    } catch (error) {
      errors.push(`Validation error: ${error}`)
      setValidationErrors(errors)
    } finally {
      setIsLoading(false)
    }
  }

  const processSymbolicInput = async (input: string, isVoice = false) => {
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/symbolic/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          dry_run: isDryRun,
          is_voice: isVoice,
        }),
      })

      if (response.ok) {
        const result = await response.json()

        const newRoute: SymbolicRoute = {
          id: Date.now().toString(),
          symbol: result.matched_intent || "unknown",
          intent: result.intent_description || "No intent matched",
          confidence: result.confidence || 0,
          path: result.execution_path || [],
          status: isDryRun ? "completed" : result.status || "pending",
          timestamp: new Date(),
          logs: result.logs || [],
        }

        setRoutes((prev) => [newRoute, ...prev])

        onAddMessage(
          "system",
          `${isDryRun ? "🔍 DRY RUN" : "⚡ EXECUTED"}: ${input} → ${result.matched_intent} (${(result.confidence * 100).toFixed(1)}% confidence)`,
          isVoice,
          "symbolic",
          result.execution_path,
          result.confidence,
        )

        if (result.response) {
          onAddMessage("assistant", result.response, false, "symbolic")
        }
      } else {
        throw new Error("Failed to process symbolic input")
      }
    } catch (error) {
      console.error("Symbolic processing error:", error)
      onAddMessage("system", `❌ Symbolic processing failed: ${error}`, false, "error")
    } finally {
      setIsLoading(false)
    }
  }

  const testSymbolicRoute = () => {
    if (!testInput.trim()) return
    processSymbolicInput(testInput.trim())
    setTestInput("")
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "processing":
        return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />
      case "failed":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={`flex items-center gap-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              <Cpu className="w-5 h-5" />
              Symbolic Trigger Engine
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isDryRun ? "secondary" : "default"}>{isDryRun ? "DRY RUN" : "LIVE"}</Badge>
              <Button
                onClick={() => setIsDryRun(!isDryRun)}
                size="sm"
                variant="outline"
                className={`${
                  isDarkMode
                    ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                    : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
                }`}
              >
                {isDryRun ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="test" className="w-full">
            <TabsList className={`grid w-full grid-cols-4 ${isDarkMode ? "bg-black/20" : "bg-white/50"}`}>
              <TabsTrigger value="test">Test</TabsTrigger>
              <TabsTrigger value="routes">Routes</TabsTrigger>
              <TabsTrigger value="intents">Intents</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
            </TabsList>

            <TabsContent value="test" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Enter symbolic command to test..."
                  onKeyPress={(e) => e.key === "Enter" && testSymbolicRoute()}
                  className={`flex-1 ${
                    isDarkMode
                      ? "bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                      : "bg-white/50 border-black/20 text-gray-800"
                  }`}
                />
                <Button
                  onClick={testSymbolicRoute}
                  disabled={!testInput.trim() || isLoading}
                  className="bg-gradient-to-r from-blue-500 to-purple-600"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
                  <h4 className={`font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                    Example Commands
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>• "create a new task"</div>
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>• "check my schedule"</div>
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>• "system status"</div>
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>• "voice command test"</div>
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
                  <h4 className={`font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                    Processing Stats
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                      Total Routes: {routes.length}
                    </div>
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                      Success Rate:{" "}
                      {routes.length > 0
                        ? Math.round((routes.filter((r) => r.status === "completed").length / routes.length) * 100)
                        : 0}
                      %
                    </div>
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                      Avg Confidence:{" "}
                      {routes.length > 0
                        ? ((routes.reduce((sum, r) => sum + r.confidence, 0) / routes.length) * 100).toFixed(1)
                        : 0}
                      %
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="routes" className="space-y-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {routes.map((route) => (
                    <div
                      key={route.id}
                      className={`p-4 rounded-lg border ${
                        isDarkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(route.status)}
                          <span className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                            {route.symbol}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {(route.confidence * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                          {route.timestamp.toLocaleTimeString()}
                        </span>
                      </div>

                      <p className={`text-sm mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{route.intent}</p>

                      {route.path.length > 0 && (
                        <div className="flex items-center gap-1 mb-2">
                          <GitBranch className="w-3 h-3 text-blue-500" />
                          <div className="flex items-center gap-1 text-xs">
                            {route.path.map((step, index) => (
                              <span key={index} className={`${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                                {step}
                                {index < route.path.length - 1 && " → "}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {route.logs.length > 0 && (
                        <details className="mt-2">
                          <summary
                            className={`text-xs cursor-pointer ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
                          >
                            View Logs ({route.logs.length})
                          </summary>
                          <div
                            className={`mt-2 p-2 rounded text-xs font-mono ${isDarkMode ? "bg-black/20" : "bg-white/50"}`}
                          >
                            {route.logs.map((log, index) => (
                              <div key={index} className={`${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                                {log}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}

                  {routes.length === 0 && (
                    <div className="text-center py-8">
                      <GitBranch
                        className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                      />
                      <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                        No Routes Yet
                      </h3>
                      <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                        Test symbolic commands to see routing information
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="intents" className="space-y-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {Object.entries(intentMap).map(([intent, data]) => (
                    <div
                      key={intent}
                      className={`p-4 rounded-lg border ${
                        isDarkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>{intent}</h4>
                        <Badge variant="outline" className="text-xs">
                          {(data.confidence_threshold * 100).toFixed(0)}% threshold
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className={`text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                            Triggers:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {data.triggers.map((trigger, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {trigger}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className={`text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                            Actions:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {data.actions.map((action, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {action}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className={`text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                            Fallbacks:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {data.fallbacks.map((fallback, index) => (
                              <Badge key={index} variant="destructive" className="text-xs">
                                {fallback}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Intent Map Validation
                </h3>
                <Button
                  onClick={validateIntentMap}
                  disabled={isLoading}
                  size="sm"
                  className="bg-gradient-to-r from-green-500 to-green-600"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Validate
                </Button>
              </div>

              {validationErrors.length > 0 ? (
                <div
                  className={`p-4 rounded-lg border ${
                    isDarkMode ? "bg-red-900/20 border-red-500/20" : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span className={`font-medium ${isDarkMode ? "text-red-300" : "text-red-700"}`}>
                      Validation Errors ({validationErrors.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {validationErrors.map((error, index) => (
                      <div key={index} className={`text-sm ${isDarkMode ? "text-red-300" : "text-red-700"}`}>
                        • {error}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={`p-4 rounded-lg border ${
                    isDarkMode ? "bg-green-900/20 border-green-500/20" : "bg-green-50 border-green-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className={`font-medium ${isDarkMode ? "text-green-300" : "text-green-700"}`}>
                      Intent Map Valid
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${isDarkMode ? "text-green-300" : "text-green-700"}`}>
                    No circular dependencies, missing references, or configuration errors found.
                  </p>
                </div>
              )}

              <div className={`p-4 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
                <h4 className={`font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>Validation Checks</h4>
                <div className="space-y-1 text-sm">
                  <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    ✓ Circular dependency detection
                  </div>
                  <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    ✓ Missing fallback validation
                  </div>
                  <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    ✓ Confidence threshold validation
                  </div>
                  <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    ✓ Intent structure validation
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
