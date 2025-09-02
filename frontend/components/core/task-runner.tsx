"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Terminal,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Activity,
  Zap,
} from "lucide-react"
import type { Message } from "@/app/page"

interface Task {
  id: string
  name: string
  command: string
  status: "idle" | "running" | "completed" | "failed" | "paused"
  startTime?: Date
  endTime?: Date
  duration?: number
  output: string[]
  errors: string[]
  exitCode?: number
  pid?: number
}

interface SystemLog {
  id: string
  timestamp: Date
  level: "info" | "warn" | "error" | "debug"
  component: string
  message: string
}

interface TaskRunnerProps {
  messages: Message[]
  onAddMessage: (type: "user" | "assistant" | "system", content: string, isVoice?: boolean, category?: string) => void
  isDarkMode: boolean
}

export function TaskRunner({ messages, onAddMessage, isDarkMode }: TaskRunnerProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])
  const [newTaskName, setNewTaskName] = useState("")
  const [newTaskCommand, setNewTaskCommand] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const API_BASE = "http://192.168.104.205:3003"

  useEffect(() => {
    loadTasks()
    loadSystemLogs()

    // Initialize with sample tasks
    if (tasks.length === 0) {
      initializeSampleTasks()
    }
  }, [])

  const initializeSampleTasks = () => {
    const sampleTasks: Task[] = [
      {
        id: "1",
        name: "System Health Check",
        command: "python core/agents/health_checker.py",
        status: "idle",
        output: [],
        errors: [],
      },
      {
        id: "2",
        name: "Whisper STT Test",
        command: "python core/agents/whisper_test.py",
        status: "idle",
        output: [],
        errors: [],
      },
      {
        id: "3",
        name: "Symbolic Router Validation",
        command: "python core/symbols/validator.py",
        status: "idle",
        output: [],
        errors: [],
      },
      {
        id: "4",
        name: "Intent Map Loader",
        command: "python core/intents/loader.py --validate",
        status: "idle",
        output: [],
        errors: [],
      },
    ]
    setTasks(sampleTasks)
  }

  const loadTasks = async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks`)
      if (response.ok) {
        const data = await response.json()
        setTasks(data)
      }
    } catch (error) {
      console.error("Failed to load tasks:", error)
    }
  }

  const loadSystemLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/logs`)
      if (response.ok) {
        const data = await response.json()
        setSystemLogs(data)
      } else {
        // Mock system logs
        const mockLogs: SystemLog[] = [
          {
            id: "1",
            timestamp: new Date(),
            level: "info",
            component: "TaskRunner",
            message: "Task runner initialized successfully",
          },
          {
            id: "2",
            timestamp: new Date(Date.now() - 60000),
            level: "info",
            component: "SymbolicEngine",
            message: "Intent map loaded with 4 intents",
          },
          {
            id: "3",
            timestamp: new Date(Date.now() - 120000),
            level: "warn",
            component: "WhisperSTT",
            message: "Audio device not found, using default",
          },
          {
            id: "4",
            timestamp: new Date(Date.now() - 180000),
            level: "info",
            component: "GPT4",
            message: "Model loaded and ready for inference",
          },
        ]
        setSystemLogs(mockLogs)
      }
    } catch (error) {
      console.error("Failed to load system logs:", error)
    }
  }

  const createTask = async () => {
    if (!newTaskName.trim() || !newTaskCommand.trim()) return

    const newTask: Task = {
      id: Date.now().toString(),
      name: newTaskName.trim(),
      command: newTaskCommand.trim(),
      status: "idle",
      output: [],
      errors: [],
    }

    setTasks((prev) => [...prev, newTask])
    setNewTaskName("")
    setNewTaskCommand("")

    onAddMessage("system", `📋 Created new task: ${newTask.name}`, false, "task")
  }

  const runTask = async (taskId: string) => {
    setIsLoading(true)

    try {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return

      // Update task status
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "running", startTime: new Date(), output: [], errors: [] } : t,
        ),
      )

      onAddMessage("system", `🚀 Starting task: ${task.name}`, false, "task")

      const response = await fetch(`${API_BASE}/tasks/${taskId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: task.command }),
      })

      if (response.ok) {
        const result = await response.json()

        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: result.exit_code === 0 ? "completed" : "failed",
                  endTime: new Date(),
                  duration: result.duration,
                  output: result.output || [],
                  errors: result.errors || [],
                  exitCode: result.exit_code,
                  pid: result.pid,
                }
              : t,
          ),
        )

        const statusIcon = result.exit_code === 0 ? "✅" : "❌"
        onAddMessage(
          "system",
          `${statusIcon} Task ${task.name} ${result.exit_code === 0 ? "completed" : "failed"} (${result.duration}ms)`,
          false,
          "task",
        )
      } else {
        throw new Error("Failed to run task")
      }
    } catch (error) {
      console.error("Task execution error:", error)

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "failed",
                endTime: new Date(),
                errors: [`Execution failed: ${error}`],
              }
            : t,
        ),
      )

      onAddMessage("system", `❌ Task execution failed: ${error}`, false, "error")
    } finally {
      setIsLoading(false)
    }
  }

  const stopTask = async (taskId: string) => {
    try {
      await fetch(`${API_BASE}/tasks/${taskId}/stop`, { method: "POST" })

      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "paused", endTime: new Date() } : t)))

      onAddMessage("system", `⏸️ Task stopped: ${tasks.find((t) => t.id === taskId)?.name}`, false, "task")
    } catch (error) {
      console.error("Failed to stop task:", error)
    }
  }

  const resetTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "idle",
              startTime: undefined,
              endTime: undefined,
              duration: undefined,
              output: [],
              errors: [],
              exitCode: undefined,
              pid: undefined,
            }
          : t,
      ),
    )

    onAddMessage("system", `🔄 Task reset: ${tasks.find((t) => t.id === taskId)?.name}`, false, "task")
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "failed":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "paused":
        return <Pause className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-500"
      case "warn":
        return "text-yellow-500"
      case "info":
        return "text-blue-500"
      case "debug":
        return "text-gray-500"
      default:
        return "text-gray-500"
    }
  }

  return (
    <div className="space-y-6">
      <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
            <Terminal className="w-5 h-5" />
            Task Runner & System Shell
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className={`grid w-full grid-cols-3 ${isDarkMode ? "bg-black/20" : "bg-white/50"}`}>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="logs">System Logs</TabsTrigger>
              <TabsTrigger value="create">Create Task</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map((task) => (
                  <Card
                    key={task.id}
                    className={`border ${isDarkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(task.status)}
                          <span className={`font-medium text-sm ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                            {task.name}
                          </span>
                        </div>
                        <Badge
                          variant={
                            task.status === "completed"
                              ? "default"
                              : task.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {task.status}
                        </Badge>
                      </div>

                      <div
                        className={`text-xs font-mono mb-3 p-2 rounded ${isDarkMode ? "bg-black/20" : "bg-white/50"}`}
                      >
                        {task.command}
                      </div>

                      {task.duration && (
                        <div className={`text-xs mb-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                          Duration: {task.duration}ms
                        </div>
                      )}

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => runTask(task.id)}
                          disabled={task.status === "running" || isLoading}
                          className="flex-1"
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => stopTask(task.id)}
                          disabled={task.status !== "running"}
                        >
                          <Square className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resetTask(task.id)}
                          disabled={task.status === "running"}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>

                      {(task.output.length > 0 || task.errors.length > 0) && (
                        <details className="mt-3">
                          <summary
                            className={`text-xs cursor-pointer ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
                          >
                            View Output ({task.output.length + task.errors.length} lines)
                          </summary>
                          <div
                            className={`mt-2 p-2 rounded text-xs font-mono max-h-32 overflow-y-auto ${isDarkMode ? "bg-black/20" : "bg-white/50"}`}
                          >
                            {task.output.map((line, index) => (
                              <div
                                key={`out-${index}`}
                                className={`${isDarkMode ? "text-green-300" : "text-green-700"}`}
                              >
                                {line}
                              </div>
                            ))}
                            {task.errors.map((line, index) => (
                              <div key={`err-${index}`} className={`${isDarkMode ? "text-red-300" : "text-red-700"}`}>
                                {line}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {tasks.length === 0 && (
                <div className="text-center py-8">
                  <Terminal className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
                  <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                    No Tasks Configured
                  </h3>
                  <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    Create tasks to run system commands and scripts
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {systemLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border ${
                        isDarkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${getLogLevelColor(log.level)}`}>
                            {log.level.toUpperCase()}
                          </Badge>
                          <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                            {log.component}
                          </span>
                        </div>
                        <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{log.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                    Task Name
                  </label>
                  <Input
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="Enter task name..."
                    className={`${
                      isDarkMode
                        ? "bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                        : "bg-white/50 border-black/20 text-gray-800"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                    Command
                  </label>
                  <Input
                    value={newTaskCommand}
                    onChange={(e) => setNewTaskCommand(e.target.value)}
                    placeholder="python script.py --args"
                    className={`font-mono ${
                      isDarkMode
                        ? "bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                        : "bg-white/50 border-black/20 text-gray-800"
                    }`}
                  />
                </div>

                <Button
                  onClick={createTask}
                  disabled={!newTaskName.trim() || !newTaskCommand.trim()}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Create Task
                </Button>

                <div className={`p-4 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
                  <h4 className={`font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                    Example Commands
                  </h4>
                  <div className="space-y-1 text-sm font-mono">
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                      python core/agents/health_check.py
                    </div>
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                      python core/symbols/validate.py --strict
                    </div>
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                      python core/intents/test_mapping.py
                    </div>
                    <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                      whisper audio.wav --model base
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-4 h-4 text-green-500" />
              <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                Running Tasks
              </span>
            </div>
            <p className={`text-2xl font-bold ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
              {tasks.filter((t) => t.status === "running").length}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-500" />
              <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>Completed</span>
            </div>
            <p className={`text-2xl font-bold ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
              {tasks.filter((t) => t.status === "completed").length}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>Failed</span>
            </div>
            <p className={`text-2xl font-bold ${isDarkMode ? "text-red-400" : "text-red-600"}`}>
              {tasks.filter((t) => t.status === "failed").length}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-purple-500" />
              <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>Total Tasks</span>
            </div>
            <p className={`text-2xl font-bold ${isDarkMode ? "text-purple-400" : "text-purple-600"}`}>{tasks.length}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
