"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VoiceRecorder } from "./voice-recorder"
import { RealTimeRecorder } from "./real-time-recorder"
import { FileUploadPreview } from "./file-upload-preview"
import { Send, Paperclip, Radio } from "lucide-react"

interface FilePreview {
  id: string
  file: File
  type: "image" | "video" | "document" | "other"
  preview?: string
  status: "ready" | "uploading" | "uploaded" | "error"
  progress: number
  backendId?: string
}

interface ChatInputProps {
  onSendText: (message: string) => void
  onSendVoice: (audioBlob: Blob) => void
  onSendWithFiles: (files: FilePreview[], message: string) => void
  isLoading: boolean
  isDarkMode: boolean
  messageCount: number
}

export function ChatInput({
  onSendText,
  onSendVoice,
  onSendWithFiles,
  isLoading,
  isDarkMode,
  messageCount,
}: ChatInputProps) {
  const [inputText, setInputText] = useState("")
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)

  const handleSendText = () => {
    if (!inputText.trim() || isLoading) return
    onSendText(inputText.trim())
    setInputText("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  const handleRealTimeTranscription = (text: string, isFinal: boolean) => {
    if (isFinal) {
      onSendText(text)
    }
  }

  const handleRealTimeResponse = (response: string) => {
    // This would be handled by the parent component to add assistant message
    console.log("Real-time response:", response)
  }

  const handleSendWithFiles = (files: FilePreview[], message: string) => {
    onSendWithFiles(files, message)
    setShowFileUpload(false)
  }

  return (
    <div className={`p-4 ${isDarkMode ? "bg-black/10" : "bg-white/30"} backdrop-blur-sm space-y-4`}>
      {/* Real-time Recording */}
      <RealTimeRecorder
        onTranscription={handleRealTimeTranscription}
        onResponse={handleRealTimeResponse}
        isDarkMode={isDarkMode}
        isEnabled={isRealTimeEnabled}
      />

      {/* File Upload */}
      {showFileUpload && (
        <FileUploadPreview
          onSendWithFiles={handleSendWithFiles}
          onClose={() => setShowFileUpload(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Main Input - Hide when file upload is active */}
      {!showFileUpload && (
        <div className="flex gap-2">
          <div className="flex-1 flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={handleKeyPress}
              disabled={isLoading || isRealTimeEnabled}
              className={`flex-1 ${
                isDarkMode
                  ? "bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  : "bg-white/50 border-black/20 text-gray-800"
              } backdrop-blur-sm`}
            />
            <Button
              onClick={handleSendText}
              disabled={!inputText.trim() || isLoading || isRealTimeEnabled}
              size="icon"
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowFileUpload(!showFileUpload)}
              variant={showFileUpload ? "default" : "outline"}
              size="icon"
              className={`${
                showFileUpload
                  ? "bg-gradient-to-r from-green-500 to-green-600"
                  : isDarkMode
                    ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                    : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
              } backdrop-blur-sm`}
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            <Button
              onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
              variant={isRealTimeEnabled ? "default" : "outline"}
              size="icon"
              title={isRealTimeEnabled ? "Stop real-time recording" : "Start real-time recording"}
              className={`${
                isRealTimeEnabled
                  ? "bg-gradient-to-r from-red-500 to-red-600 shadow-lg shadow-red-500/25 animate-pulse"
                  : isDarkMode
                    ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                    : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
              } backdrop-blur-sm`}
            >
              <Radio className="w-4 h-4" />
            </Button>

            <VoiceRecorder
              onSendVoice={onSendVoice}
              isLoading={isLoading}
              isDarkMode={isDarkMode}
              disabled={isRealTimeEnabled}
            />
          </div>
        </div>
      )}

      {/* Action Buttons when file upload is active */}
      {showFileUpload && (
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => setShowFileUpload(false)}
            variant="outline"
            size="sm"
            className={`${
              isDarkMode
                ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
            } backdrop-blur-sm`}
          >
            Cancel Upload
          </Button>
        </div>
      )}

      <div className={`flex items-center justify-between text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
        <span>
          {isRealTimeEnabled
            ? "🔴 Real-time recording active - AI will respond automatically"
            : showFileUpload
              ? "📎 Select files and add a message to send together"
              : "Press Enter to send, Shift+Enter for new line"}
        </span>
        <span>{messageCount} messages</span>
      </div>
    </div>
  )
}
