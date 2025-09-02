"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff } from "lucide-react"

interface VoiceRecorderProps {
  onSendVoice: (audioBlob: Blob) => void
  isLoading: boolean
  isDarkMode: boolean
  disabled?: boolean
}

export function VoiceRecorder({ onSendVoice, isLoading, isDarkMode, disabled = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [voiceLevel, setVoiceLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>()

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length
    setVoiceLevel(average / 255)

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio)
    }
  }, [isRecording])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Set up audio analysis
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        onSendVoice(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
        if (audioContextRef.current) {
          audioContextRef.current.close()
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      analyzeAudio()
    } catch (error) {
      console.error("Error starting recording:", error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setVoiceLevel(0)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }

  const VoiceVisualizer = () => (
    <div className="flex items-center justify-center gap-1 h-8 mr-2">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1 bg-gradient-to-t from-blue-400 to-purple-500 rounded-full transition-all duration-150 ${
            isRecording ? "animate-pulse" : ""
          }`}
          style={{
            height: `${Math.max(4, voiceLevel * 32 + Math.sin(Date.now() / 200 + i) * 4)}px`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  )

  return (
    <div className="flex items-center gap-2">
      {isRecording && <VoiceVisualizer />}
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isLoading || disabled}
        size="icon"
        variant={isRecording ? "destructive" : "outline"}
        className={`${
          isRecording
            ? "animate-pulse shadow-lg shadow-red-500/25"
            : isDarkMode
              ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
              : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
        } backdrop-blur-sm`}
      >
        {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </Button>
    </div>
  )
}
