"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Radio, Volume2, Wifi, WifiOff, Mic, MicOff } from "lucide-react"
import { is } from "date-fns/locale"

interface RealTimeRecorderProps {
  onTranscription: (text: string, isFinal: boolean) => void
  onResponse: (response: string) => void
  isDarkMode: boolean
  isEnabled: boolean
}
let ebmlHeader: Blob | null = null;
let checkInterval: NodeJS.Timeout | null = null;

export function RealTimeRecorder({ onTranscription, onResponse, isDarkMode, isEnabled }: RealTimeRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentTranscription, setCurrentTranscription] = useState("")
  const [accumulatedTranscription, setAccumulatedTranscription] = useState("")
  const [voiceLevel, setVoiceLevel] = useState(0)
  const [silenceTimer, setSilenceTimer] = useState(0)
  const [isProcessingResponse, setIsProcessingResponse] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(
    "disconnected",
  )

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number>()
  const voiceLevelRef = useRef<number>(0)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const silenceCounterRef = useRef<number>(0)
  const isProcessingResponseRef = useRef<boolean>(false)
  const isRecordingRef = useRef<boolean>(false)

  // const WEBSOCKET_BASE = "ws://192.168.104.205:3003"
  const WEBSOCKET_BASE = "ws://192.168.104.205:3003"
  const API_BASE = "http://192.168.104.205:3003"
  const SILENCE_THRESHOLD = 0.03 // Voice activity threshold
  const SILENCE_DURATION = 3000 // 3 seconds of silence before auto-response
  const SILENCE_CHECK_INTERVAL = 100 // Check silence every 100ms

  useEffect(() => {
    if (isEnabled && !isConnected) {
      connectWebSocket()
    } else if (!isEnabled && isConnected) {
      disconnectWebSocket()
    }

    return () => {
      disconnectWebSocket()
    }
  }, [isEnabled])

  useEffect(() => {
    if (isEnabled) {
      startRecording()
    } else {
      stopRecording()
    }
  }, [isEnabled])

  const connectWebSocket = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus("connecting")

    try {
      const ws = new WebSocket(`${WEBSOCKET_BASE}/ws/record`)

      ws.onopen = () => {
        console.log("WebSocket connection established")
        setConnectionStatus("connected")
        setIsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === "transcription") {
            const transcription = data.text
            console.log("Received transcription:", transcription)

            if (transcription && transcription.trim()) {
              setCurrentTranscription(transcription)
              setAccumulatedTranscription((prev) => {
                const newText = prev + " " + transcription
                onTranscription(newText.trim(), false)
                return newText
              })

              // Reset silence counter when we get new transcription
              silenceCounterRef.current = 0
              setSilenceTimer(0)
            }
          } else if (data.type === "error") {
            console.error("Server error:", data.message)
            setConnectionStatus("error")
          }
        } catch (error) {
          // Handle plain text responses (backward compatibility)
          const transcription = event.data
          if (transcription && transcription.trim() && !transcription.startsWith("Error:")) {
            setCurrentTranscription(transcription)
            setAccumulatedTranscription((prev) => {
              const newText = prev + " " + transcription
              onTranscription(newText.trim(), false)
              return newText
            })

            silenceCounterRef.current = 0
            setSilenceTimer(0)
          }
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        setConnectionStatus("error")
        setIsConnected(false)
      }

      ws.onclose = () => {
        console.log("WebSocket connection closed")
        setConnectionStatus("disconnected")
        setIsConnected(false)
   
        if (isRecordingRef.current) {
          console.log("Recording is active, attempting to reconnect WebSocket...");
          setTimeout(() => {
            connectWebSocket(); // Reconnect WebSocket
          }, 1000); // Retry after 1 second
        }
      }

      websocketRef.current = ws
    } catch (error) {
      console.error("WebSocket connection failed:", error)
      setConnectionStatus("error")
      setIsConnected(false)
    }
  }, [onTranscription])

  const disconnectWebSocket = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
    }
    setConnectionStatus("disconnected")
    setIsConnected(false)
    stopRecording()
  }, [])

  const getAIResponse = async (text: string) => {
    if (!text.trim() || isProcessingResponseRef.current) return
    isProcessingResponseRef.current = true
    setIsProcessingResponse(isProcessingResponseRef.current)

    console.log("Getting AI response for:", text)

    try {
      const response = await fetch(`${API_BASE}/rag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("Received AI response:", data.response)
        onResponse(data.response)

        if (data.audio_url) {
          try {
            const audioUrl = `${API_BASE}${data.audio_url}`
            const audio = new Audio(audioUrl)
            audio.play().catch(error => {
              console.error("Error playing TTS audio:", error)
            })
          } catch (audioError) {
            console.error("Error loading TTS audio:", audioError)
          }
        }
        // Clear accumulated transcription after getting response
        setAccumulatedTranscription("")
        setCurrentTranscription("")
      } else {
        setAccumulatedTranscription("")
        setCurrentTranscription("")
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      console.error("Failed to get AI response:", error)
      onResponse("Sorry, I'm having trouble connecting to the AI service. Please try again.")
    } finally {
      isProcessingResponseRef.current = false
      setIsProcessingResponse(isProcessingResponseRef.current)
    }
  }

  const checkSilenceAndRespond = useCallback(() => {
    if (voiceLevelRef.current < SILENCE_THRESHOLD) {
      silenceCounterRef.current += SILENCE_CHECK_INTERVAL
      setSilenceTimer(silenceCounterRef.current)
      // If we've been silent for the threshold duration and have accumulated text
      if (silenceCounterRef.current >= SILENCE_DURATION && accumulatedTranscription.trim() && !isProcessingResponseRef.current) {
        console.log("Silence detected, requesting AI response...")

        // Mark transcription as final
        onTranscription(accumulatedTranscription.trim(), true)

        // Get AI response using your backend endpoint
        getAIResponse(accumulatedTranscription.trim())

        // Reset silence counter
        silenceCounterRef.current = 0
        setSilenceTimer(0)
      }
    } else {
      // Voice detected, reset silence counter
      silenceCounterRef.current = 0
      setSilenceTimer(0)
    }
  }, [voiceLevel, accumulatedTranscription, isProcessingResponse, onTranscription])

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !isRecordingRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = average / 255;
    voiceLevelRef.current = normalizedLevel;
    setVoiceLevel(voiceLevelRef.current );

    // Continue analyzing audio only if recording is active
    if (isRecordingRef.current) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [isRecordingRef.current]);

  const startRecording = async () => {
    try {
      console.log("Starting recording...")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      })
      
      streamRef.current = stream

      // Set up audio analysis
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256


      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "audio/webm", // Replace with a supported MIME type
      });

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0 && websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(e.data);
        }
      };

      mediaRecorderRef.current.start(3000); // chunk every 250ms

      isRecordingRef.current = true
      setIsRecording(true)
      console.log("Recording started")

      // Reset states
      setCurrentTranscription("")
      setAccumulatedTranscription("")
      silenceCounterRef.current = 0
      setSilenceTimer(0)
    } catch (error) {
      console.error("Error starting recording:", error)
      setConnectionStatus("error")
    }
  }
  useEffect(() => {
    analyzeAudio()
    if (isRecording) {
      checkInterval = setInterval(() => 
        checkSilenceAndRespond(), SILENCE_CHECK_INTERVAL)
    }
    else {
      if (checkInterval !== null) {
        clearInterval(checkInterval)
      }
    }
  }, [isRecording])
  
  
  const stopRecording = () => {
      console.log("Stopping recording...")
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop()
      isRecordingRef.current = false
      setIsRecording(false)
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    voiceLevelRef.current = 0
    setVoiceLevel(voiceLevelRef.current)
    setSilenceTimer(0)
    silenceCounterRef.current = 0

    // If we have accumulated transcription when stopping, send it as final and get response
    if (accumulatedTranscription.trim() && !isProcessingResponseRef.current) {
      onTranscription(accumulatedTranscription.trim(), true)
      getAIResponse(accumulatedTranscription.trim())
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-green-500"
      case "connecting":
        return "text-yellow-500"
      case "error":
        return "text-red-500"
      default:
        return "text-gray-500"
    }
  }

  const VoiceVisualizer = () => (
    <div className="flex items-center justify-center gap-1 h-12">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className={`w-1 bg-gradient-to-t from-blue-400 to-purple-500 rounded-full transition-all duration-150 ${
            isRecording ? "animate-pulse" : ""
          }`}
          style={{
            height: `${Math.max(4, voiceLevel * 48 + Math.sin(Date.now() / 200 + i) * 8)}px`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  )

  const formatSilenceTimer = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const remaining = Math.max(0, SILENCE_DURATION / 1000 - seconds)
    return `${remaining.toFixed(1)}s`
  }

  if (!isEnabled) return null

  return (
    <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"} mb-4`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isRecording ? "text-red-500 animate-pulse" : getConnectionStatusColor()}`} />
            <span className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              Real-Time Recording
            </span>
            <Badge variant={isRecording ? "destructive" : isConnected ? "default" : "secondary"} className="text-xs">
              {isRecording ? "Recording" : connectionStatus}
            </Badge>
            {isProcessingResponse && (
              <Badge variant="outline" className="text-xs animate-pulse">
                AI Responding...
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {connectionStatus === "connected" ? (
              <Wifi className={`w-4 h-4 ${getConnectionStatusColor()}`} />
            ) : (
              <WifiOff className={`w-4 h-4 ${getConnectionStatusColor()}`} />
            )}
            {isRecording ? <Mic className="w-4 h-4 text-red-500" /> : <MicOff className="w-4 h-4 text-gray-500" />}
          </div>
        </div>

        {isRecording && (
          <>
            <VoiceVisualizer />

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className={`${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>Voice Level</span>
                <span className={`${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {(voiceLevel * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={voiceLevel * 100} className="h-1" />
            </div>

            {/* Silence Timer */}
            {silenceTimer > 1000 && accumulatedTranscription.trim() && !isProcessingResponse && (
              <div className="mt-3 flex items-center justify-center">
                <div
                  className={`px-3 py-1 rounded-full text-xs ${
                    isDarkMode ? "bg-yellow-900/30 text-yellow-300" : "bg-yellow-100 text-yellow-700"
                  } border border-yellow-500/20`}
                >
                  🤫 Silence detected - AI will respond in {formatSilenceTimer(silenceTimer)}
                </div>
              </div>
            )}

            {/* Processing Response Indicator */}
            {isProcessingResponse && (
              <div className="mt-3 flex items-center justify-center">
                <div
                  className={`px-3 py-1 rounded-full text-xs ${
                    isDarkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-100 text-blue-700"
                  } border border-blue-500/20 animate-pulse`}
                >
                  🤖 AI is thinking...
                </div>
              </div>
            )}

            {/* Live Transcription Display */}
            {accumulatedTranscription && (
              <div
                className={`mt-4 p-3 rounded-lg ${isDarkMode ? "bg-white/10" : "bg-black/5"} border-l-4 border-blue-500`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Volume2 className="w-3 h-3 text-blue-500" />
                  <span className={`text-xs font-medium ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                    Live Speech
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {accumulatedTranscription.split(" ").filter((word) => word.trim()).length} words
                  </Badge>
                </div>
                <p className={`text-sm ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  {accumulatedTranscription}
                  {currentTranscription && (
                    <span className={`${isDarkMode ? "text-blue-300" : "text-blue-600"} animate-pulse`}>
                      {" " + currentTranscription}
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className={`mt-2 text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              💡 Speak naturally - AI will respond automatically after {SILENCE_DURATION / 1000} seconds of silence
            </div>
          </>
        )}

        {!isRecording && connectionStatus === "connected" && (
          <div className="text-center py-4">
            <div className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
              🎤 Ready to record - Toggle the button to start real-time conversation
            </div>
          </div>
        )}

        {connectionStatus === "error" && (
          <div className="text-center py-4">
            <div className={`text-sm ${isDarkMode ? "text-red-300" : "text-red-600"}`}>
              ❌ Connection failed - Check if backend is running at {API_BASE}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
