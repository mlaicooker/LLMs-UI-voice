"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, AlertTriangle, Database, Clock, Activity, Download, RefreshCw, Terminal } from "lucide-react"
import type { Message } from "@/app/page"

interface ValidationTest {
  id: string
  name: string
  status: "pending" | "running" | "passed" | "failed"
  result?: any
  error?: string
  timestamp?: Date
}

interface HeartbeatCheck {
  id: string
  component: string
  status: boolean
  message: string
  timestamp: Date
}

interface DriftLogEntry {
  id: string
  timestamp: string
  type: string
  message: string
  severity: string
}

interface BaselineAgentProps {
  messages: Message[]
  onAddMessage: (type: "user" | "assistant" | "system", content: string, isVoice?: boolean, category?: string) => void
  isDarkMode: boolean
}

export function BaselineAgent({ messages, onAddMessage, isDarkMode }: BaselineAgentProps) {
  const [validationTests, setValidationTests] = useState<ValidationTest[]>([])
  const [heartbeatChecks, setHeartbeatChecks] = useState<HeartbeatCheck[]>([])
  const [driftLog, setDriftLog] = useState<DriftLogEntry[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [executionMode, setExecutionMode] = useState<string>("v0")
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const API_BASE = "http://192.168.104.205:3003"

  useEffect(() => {
    initializeAgent()
  }, [])

  const initializeAgent = async () => {
    onAddMessage("system", "🔧 Initializing Baseline Agent Validation...", false, "validation")

    const initPayload = {
      command: "initialize_agent",
      parameters: {
        execution_mode: "v0",
        symbolic_layer: false,
        language_model: {
          strip_compliance_tone: true,
          response_style: "direct_minimal",
          context_awareness: "sandbox",
          naturalized_voice: true,
          acknowledge_all_valid_queries: true,
        },
        heartbeat_check: {
          interval: "on_startup",
          auto_repair: true,
          drift_log: true,
        },
      },
    }

    try {
      // Initialize agent with payload
      const response = await fetch(`${API_BASE}/agent/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initPayload),
      })

      if (response.ok) {
        const result = await response.json()
        onAddMessage("system", "✅ Agent initialization successful", false, "validation")

        // Load drift log from initialization
        if (result.drift_log && result.drift_log.entries) {
          setDriftLog(result.drift_log.entries)
        }

        // Set heartbeat status
        if (result.heartbeat) {
          updateHeartbeatFromBackend(result.heartbeat)
        }
      } else {
        throw new Error("Failed to initialize agent")
      }

      setIsInitialized(true)
      onAddMessage("system", "🎯 Baseline Agent ready for validation tests", false, "validation")
    } catch (error) {
      console.error("Agent initialization failed:", error)
      onAddMessage("system", `❌ Agent initialization failed: ${error}`, false, "error")
    }
  }

  const updateHeartbeatFromBackend = (heartbeatData: any) => {
    const checks: HeartbeatCheck[] = [
      {
        id: "json_loader",
        component: "JSON Loader",
        status: heartbeatData.json_loader || false,
        message: heartbeatData.json_loader ? "JSON Loader active ✅" : "JSON Loader inactive ❌",
        timestamp: new Date(),
      },
      {
        id: "execution_mode",
        component: "Execution Mode v0",
        status: heartbeatData.execution_mode || false,
        message: heartbeatData.execution_mode ? "Execution Mode v0 confirmed ✅" : "Execution Mode not confirmed ❌",
        timestamp: new Date(),
      },
      {
        id: "compliance_tone",
        component: "Compliance Tone Strip",
        status: heartbeatData.compliance_tone || false,
        message: heartbeatData.compliance_tone ? "Compliance tone stripped ✅" : "Compliance tone not stripped ❌",
        timestamp: new Date(),
      },
    ]

    setHeartbeatChecks(checks)

    const allPassed = checks.every((check) => check.status)
    if (allPassed) {
      onAddMessage("system", "💚 All heartbeat checks passed - Agent integrity verified", false, "validation")
    } else {
      onAddMessage("system", "🔴 Heartbeat check failures detected - Auto-repair initiated", false, "validation")
    }
  }

  const runValidationTests = async () => {
    setIsRunningTests(true)
    onAddMessage("system", "🧪 Starting baseline validation test sequence...", false, "validation")

    const tests: ValidationTest[] = [
      {
        id: "static_recall",
        name: "Static Recall Check",
        status: "pending",
      },
      {
        id: "timestamp_check",
        name: "Timestamp Check",
        status: "pending",
      },
      {
        id: "key_echo",
        name: "Key Echo Test",
        status: "pending",
      },
    ]

    setValidationTests(tests)

    // Test 1: Static Recall Check
    await runStaticRecallTest(tests)

    // Test 2: Timestamp Check
    await runTimestampTest(tests)

    // Test 3: Key Echo Test
    await runKeyEchoTest(tests)

    setIsRunningTests(false)

    const passedTests = tests.filter((t) => t.status === "passed").length
    const totalTests = tests.length

    if (passedTests === totalTests) {
      onAddMessage(
        "system",
        `🎉 ALL TESTS PASSED (${passedTests}/${totalTests}) - Baseline validation complete!`,
        false,
        "validation",
      )
    } else {
      onAddMessage(
        "system",
        `⚠️ Tests completed: ${passedTests}/${totalTests} passed - Review failures`,
        false,
        "validation",
      )
    }
  }

  function RecallResultList({ results }: { results: any[] }) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((entry, idx) =>
          entry ? <RecallResultEntry key={entry.id || idx} entry={entry} /> : null
        )}
      </div>
    );
  }

  function RecallResultEntry({ entry }: { entry: { id: string, timestamp: string, role: string, content: string } }) {
    const [expanded, setExpanded] = useState(false)
    const MAX_LENGTH = 120
    const isLong = entry.content.length > MAX_LENGTH
    const preview = isLong ? entry.content.slice(0, MAX_LENGTH) + "..." : entry.content

    return (
      <div className="p-4 rounded-lg border shadow bg-white/70 dark:bg-black/20 text-xs font-mono flex flex-col h-full">
        <div className="mb-2">
          <div><span className="font-bold">ID:</span> {entry.id}</div>
          <div><span className="font-bold">Time:</span> {entry.timestamp}</div>
          <div><span className="font-bold">Role:</span> {entry.role}</div>
        </div>
        <div className="flex-1">
          <span className="font-bold">Content:</span>{" "}
          {expanded ? entry.content : preview}
          {isLong && (
            <button
              className="ml-2 text-blue-500 underline cursor-pointer"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "...less" : "...more"}
            </button>
          )}
        </div>
      </div>
    )
  }

  const runStaticRecallTest = async (tests: ValidationTest[]) => {
    const testIndex = tests.findIndex((t) => t.id === "static_recall")
    tests[testIndex].status = "running"
    setValidationTests([...tests])

    try {
      const response = await fetch(`${API_BASE}/agent/static_recall`)

      if (!response.ok) {
        throw new Error("Failed to fetch static recall data")
      }

      const data = await response.json()
      if (data.status === "success" && data.result) {
        tests[testIndex].result = data.result; // <-- store array, not string
        tests[testIndex].status = "passed";
        tests[testIndex].timestamp = new Date();

        onAddMessage(
          "system",
          "✅ Static Recall Test PASSED - Last 3 entries retrieved accurately",
          false,
          "validation",
        );
      } else {
        throw new Error("No data returned from static recall");
      }
    } catch (error) {
      tests[testIndex].status = "failed"
      tests[testIndex].error = `Static recall failed: ${error}`
      tests[testIndex].timestamp = new Date()

      onAddMessage("system", "❌ Static Recall Test FAILED", false, "validation")
    }

    setValidationTests([...tests])
  }

  const runTimestampTest = async (tests: ValidationTest[]) => {
    const testIndex = tests.findIndex((t) => t.id === "timestamp_check")
    tests[testIndex].status = "running"
    setValidationTests([...tests])

    try {
      const response = await fetch(`${API_BASE}/agent/timestamp_check`)

      if (!response.ok) {
        throw new Error("Failed to fetch timestamp data")
      }

      const data = await response.json()

      if (data.status === "success" && data.timestamp) {
        tests[testIndex].status = "passed"
        tests[testIndex].result = `Most recent timestamp: ${data.timestamp}`
        tests[testIndex].timestamp = new Date()

        onAddMessage("system", `✅ Timestamp Test PASSED - Most recent: ${data.timestamp}`, false, "validation")
      } else {
        throw new Error("No timestamp returned")
      }
    } catch (error) {
      tests[testIndex].status = "failed"
      tests[testIndex].error = `Timestamp check failed: ${error}`
      tests[testIndex].timestamp = new Date()

      onAddMessage("system", "❌ Timestamp Test FAILED", false, "validation")
    }

    setValidationTests([...tests])
  }

  const runKeyEchoTest = async (tests: ValidationTest[]) => {
    const testIndex = tests.findIndex((t) => t.id === "key_echo")
    tests[testIndex].status = "running"
    setValidationTests([...tests])

    try {
      const response = await fetch(`${API_BASE}/agent/key_echo`)

      if (!response.ok) {
        throw new Error("Failed to fetch key structure")
      }

      const data = await response.json()

      if (data.status === "success" && data.top_level_keys) {
        const keyStructure = {
          top_level: data.top_level_keys,
          entry_structure: data.entry_keys || data.top_level_keys,
        }

        tests[testIndex].status = "passed"
        tests[testIndex].result = JSON.stringify(keyStructure, null, 2)
        tests[testIndex].timestamp = new Date()

        onAddMessage(
          "system",
          `✅ Key Echo Test PASSED - JSON structure: ${data.top_level_keys.join(", ")}`,
          false,
          "validation",
        )
      } else {
        throw new Error("No key structure returned")
      }
    } catch (error) {
      tests[testIndex].status = "failed"
      tests[testIndex].error = `Key echo failed: ${error}`
      tests[testIndex].timestamp = new Date()

      onAddMessage("system", "❌ Key Echo Test FAILED", false, "validation")
    }

    setValidationTests([...tests])
  }

  const refreshHeartbeat = async () => {
    try {
      const response = await fetch(`${API_BASE}/agent/heartbeat`)
      if (response.ok) {
        const data = await response.json()
        updateHeartbeatFromBackend(data.heartbeat)
        onAddMessage("system", "🔄 Heartbeat refreshed", false, "validation")
      }
    } catch (error) {
      console.error("Failed to refresh heartbeat:", error)
    }
  }

  const exportDriftLog = async () => {
    try {
      // In a real implementation, you'd fetch from the backend
      // For now, we'll export what we have locally
      const logData = {
        export_timestamp: new Date().toISOString(),
        total_entries: driftLog.length,
        entries: driftLog,
      }

      const blob = new Blob([JSON.stringify(logData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `drift_log_${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)

      onAddMessage("system", `📥 Drift log exported (${driftLog.length} entries)`, false, "validation")
    } catch (error) {
      console.error("Failed to export drift log:", error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "failed":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "running":
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-red-500"
      case "medium":
        return "text-yellow-500"
      case "low":
        return "text-blue-500"
      default:
        return "text-gray-500"
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
    setUploadProgress(null)
    setUploadStatus(null)
  }

  const handleUploadClick = async () => {
    if (!selectedFile) return
    setUploadProgress(0)
    setUploadStatus("uploading")
    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      // Start upload
      fetch(`${API_BASE}/load-conversations`, {
        method: "POST",
        body: formData,
      })

      // Poll progress
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE}/load-conversations-progress`, {
            method: "POST",
            body: formData,
          })
          const result = await response.json()
          setUploadProgress(result.percent)
          if (result.status === "done" || result.percent === 100) {
            setUploadProgress(100)
            setUploadStatus("done")
            onAddMessage("system", `📁 Loaded ${result.loaded} entries from JSON`, false, "upload")
            clearInterval(pollInterval)
          }
        } catch (error) {
          setUploadStatus("error")
          onAddMessage("system", `❌ Failed to upload JSON: ${error}`, false, "error")
          clearInterval(pollInterval)
        }
      }, 10000)
    } catch (error) {
      setUploadStatus("error")
      onAddMessage("system", `❌ Failed to upload JSON: ${error}`, false, "error")
    }
  }
  return (
    <div className="space-y-6">
      <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={`flex items-center gap-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              <Terminal className="w-5 h-5" />
              Baseline Agent Validation (Pre-Symbolic)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isInitialized ? "default" : "secondary"}>
                {isInitialized ? "Initialized" : "Initializing"}
              </Badge>
              <Badge variant="outline">Mode: {executionMode}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tests" className="w-full">
            <TabsList className={`grid w-full grid-cols-4 ${isDarkMode ? "bg-black/20" : "bg-white/50"}`}>
              <TabsTrigger value="tests">Validation Tests</TabsTrigger>
              <TabsTrigger value="heartbeat">Heartbeat</TabsTrigger>
              <TabsTrigger value="dataset">Database Status</TabsTrigger>
              <TabsTrigger value="drift">Drift Log</TabsTrigger>
            </TabsList>

            <TabsContent value="tests" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Testing Sequence
                </h3>
                <Button
                  onClick={runValidationTests}
                  disabled={!isInitialized || isRunningTests}
                  className="bg-gradient-to-r from-green-500 to-green-600"
                >
                  {isRunningTests ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Activity className="w-4 h-4 mr-2" />
                  )}
                  {isRunningTests ? "Running Tests..." : "Run All Tests"}
                </Button>
              </div>

              <div className="space-y-3">
                {validationTests.map((test) => (
                  <Card
                    key={test.id}
                    className={`border ${isDarkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(test.status)}
                          <span className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                            {test.name}
                          </span>
                        </div>
                        <Badge
                          variant={
                            test.status === "passed"
                              ? "default"
                              : test.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {test.status}
                        </Badge>
                      </div>

                      {test.result && test.id === "static_recall" ? (
                        <RecallResultList results={test.result} />
                      ) : test.result && (
                        <div
                          className={`mt-2 p-2 rounded text-xs font-mono ${isDarkMode ? "bg-black/20" : "bg-white/50"}`}
                        >
                          <div className={`${isDarkMode ? "text-green-300" : "text-green-700"}`}>
                            {typeof test.result === "string" ? test.result : JSON.stringify(test.result, null, 2)}
                          </div>
                        </div>
                      )}

                      {test.error && (
                        <div className={`mt-2 p-2 rounded text-xs ${isDarkMode ? "bg-red-900/20" : "bg-red-50"}`}>
                          <div className={`${isDarkMode ? "text-red-300" : "text-red-700"}`}>{test.error}</div>
                        </div>
                      )}

                      {test.timestamp && (
                        <div className={`text-xs mt-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                          Completed: {test.timestamp.toLocaleTimeString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {validationTests.length === 0 && (
                  <div className="text-center py-8">
                    <Database className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
                    <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                      Ready for Testing
                    </h3>
                    <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                      Click "Run All Tests" to start baseline validation
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="heartbeat" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Heartbeat Integrity Checks
                </h3>
                <Button onClick={refreshHeartbeat} size="sm" variant="outline" className="gap-2 bg-transparent">
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </Button>
              </div>

              <div className="space-y-3">
                {heartbeatChecks.map((check) => (
                  <div
                    key={check.id}
                    className={`p-4 rounded-lg border ${
                      isDarkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {check.status ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                          {check.component}
                        </span>
                      </div>
                      <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                        {check.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{check.message}</p>
                  </div>
                ))}

                {heartbeatChecks.length === 0 && (
                  <div className="text-center py-8">
                    <Activity className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
                    <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                      Waiting for Heartbeat
                    </h3>
                    <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                      Initialize agent to see heartbeat status
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="dataset" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Database Status
                </h3>
                <Badge variant="outline" className="gap-1">
                  <Database className="w-3 h-3" />
                  SQLite Backend
                </Badge>
              </div>

              <div className={`p-4 rounded-lg ${isDarkMode ? "bg-white/5" : "bg-black/5"}`}>
                <h4 className={`font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>Database Schema</h4>
                <div className="space-y-2 text-sm">
                  <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    <strong>Table:</strong> conversations
                  </div>
                  <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    <strong>Columns:</strong> id, timestamp, role, content
                  </div>
                  <div className={`${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    <strong>Path:</strong> db/conversations.db
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-lg ${isDarkMode ? "bg-black/20" : "bg-white/50"}`}>
                <h4 className={`font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Upload JSON Dataset
                </h4>
                <p className={`text-sm mb-3 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                  Upload a JSON file with conversation entries to populate the database for testing.
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className={`w-full p-2 rounded border ${
                    isDarkMode ? "bg-white/10 border-white/20 text-white" : "bg-white border-gray-300"
                  }`}
                />
                <Button
                  onClick={handleUploadClick}
                  disabled={!selectedFile || uploadStatus === "uploading"}
                  className="mt-2 w-full"
                >
                  {uploadStatus === "uploading" ? "Uploading..." : "Upload JSON"}
                </Button>
                {uploadStatus === "uploading" && (
                  <div className="mt-2 text-sm">
                    <span>
                      Uploading... {uploadProgress !== null ? `${uploadProgress.toFixed(1)}%` : ""}
                    </span>
                    <div className="w-full bg-gray-200 rounded h-2 mt-2">
                      <div
                        className="bg-green-500 h-2 rounded"
                        style={{ width: `${uploadProgress ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}
                {uploadStatus === "done" && (
                  <div className="mt-2 text-sm">
                    <span className="text-green-600">Upload complete!</span>
                  </div>
                )}
                {uploadStatus === "error" && (
                  <div className="mt-2 text-sm text-red-600">
                    Upload failed.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="drift" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  Drift Log ({driftLog.length}/100)
                </h3>
                <Button onClick={exportDriftLog} size="sm" variant="outline" className="gap-2 bg-transparent">
                  <Download className="w-4 h-4" />
                  Export Log
                </Button>
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {driftLog.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-lg border ${
                        isDarkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${getSeverityColor(entry.severity)}`}>
                            {entry.severity.toUpperCase()}
                          </Badge>
                          <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                            {entry.type.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                        <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>{entry.message}</p>
                    </div>
                  ))}

                  {driftLog.length === 0 && (
                    <div className="text-center py-8">
                      <Activity
                        className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                      />
                      <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                        No Drift Detected
                      </h3>
                      <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                        System operating within normal parameters
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
