"use client"

import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChatHeader } from "./chat-header"
import { MessageList } from "./message-list"
import { ChatInput } from "./chat-input"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import type { Message } from "@/app/page"

interface FilePreview {
  id: string
  file: File
  type: "image" | "video" | "document" | "other"
  preview?: string
  status: "ready" | "uploading" | "uploaded" | "error"
  progress: number
  backendId?: string
}

interface ChatInterfaceProps {
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
  isSoundEnabled: boolean
}

export function ChatInterface({ messages, onAddMessage, isDarkMode, isSoundEnabled }: ChatInterfaceProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const API_BASE = "http://192.168.104.205:3003"

  const playSound = (type: "send" | "receive" | "error") => {
    if (!isSoundEnabled) return

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    const frequencies = { send: 800, receive: 600, error: 300 }
    oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime)
    oscillator.type = "sine"

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  }

  // Load chat history function
  const loadChatHistory = async (beforeMessageId?: string): Promise<Message[]> => {
    try {
      const params = new URLSearchParams()
      if (beforeMessageId) {
        params.append("before", beforeMessageId)
      }
      params.append("limit", "20") // Load 20 messages at a time

      const response = await fetch(`${API_BASE}/chat-history/messages?${params}`)

      if (!response.ok) {
        throw new Error("Failed to load chat history")
      }

      const data = await response.json()

      // Convert backend format to frontend Message format
      const historyMessages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id,
        type: msg.type as "user" | "assistant" | "system",
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        isVoice: msg.is_voice || false,
        category: msg.category || undefined,
        symbolPath: msg.symbol_path || undefined,
        confidence: msg.confidence || undefined,
      }))

      // Add system message about loaded history count if this is the first load
      if (!beforeMessageId && historyMessages.length > 0) {
        onAddMessage("system", `📚 Loaded ${historyMessages.length} messages from chat history`, false, "history")
      }

      return historyMessages
    } catch (error) {
      console.error("Error loading chat history:", error)
      toast({
        title: "History Load Error",
        description: "Failed to load chat history. Please try again.",
        variant: "destructive",
      })
      return []
    }
  }

  const sendTextMessage = async (message: string) => {
    if (!message.trim() || isLoading) return

    onAddMessage("user", message)
    setIsLoading(true)
    playSound("send")

    try {
      const response = await fetch(`${API_BASE}/rag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: message }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response")
      }

      const data = await response.json()
      onAddMessage("assistant", data.response)
      playSound("receive")
      
      if (data.audio_url && isSoundEnabled) {
        try {
          const audioUrl = `${API_BASE.replace('http://', 'http://')}${data.audio_url}`
          const audio = new Audio(audioUrl)
          audio.play().catch(error => {
            console.error("Error playing audio:", error)
          })
        } catch (audioError) {
          console.error("Error loading audio:", audioError)
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      playSound("error")
      toast({
        title: "Connection Error",
        description: "Failed to connect to AI service. Please check if the backend is running.",
        variant: "destructive",
      })
      onAddMessage(
        "assistant",
        "Sorry, I'm having trouble connecting to the AI service. Please check if the backend is running.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const sendVoiceMessage = async (audioBlob: Blob) => {
    setIsLoading(true)
    onAddMessage("user", "🎤 Processing voice message...", true)
    playSound("send")

    try {
      const formData = new FormData()
      formData.append("file", audioBlob, "audio.wav")

      const response = await fetch(`${API_BASE}/stt-rag`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to process voice message")
      }

      const data = await response.json()

      // Update the last message with transcription
      onAddMessage("user", `"${data.transcription}"`, true)
      onAddMessage("assistant", data.response)
      playSound("receive")
      
      if (data.audio_url && isSoundEnabled) {
        try {
          const audioUrl = `${API_BASE}${data.audio_url}`
          const audio = new Audio(audioUrl)
          audio.play().catch(error => {
            console.error("Error playing audio:", error)
          })
        } catch (audioError) {
          console.error("Error loading audio:", audioError)
        }
      }
    } catch (error) {
      console.error("Error processing voice message:", error)
      playSound("error")
      toast({
        title: "Voice Processing Error",
        description: "Failed to process voice message. Please try again.",
        variant: "destructive",
      })
      onAddMessage("assistant", "Sorry, I couldn't process your voice message. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const sendWithFiles = async (files: FilePreview[], message: string) => {
    setIsLoading(true)
    playSound("send")

    try {
      // Create a combined message with files and text
      const fileNames = files.map((f) => f.file.name).join(", ")
      const combinedMessage = message
        ? `${message}\n\n📎 Files: ${fileNames}`
        : `📎 Sent ${files.length} file${files.length > 1 ? "s" : ""}: ${fileNames}`

      onAddMessage("user", combinedMessage)

      // Upload files to backend
      const uploadPromises = files.map(async (filePreview) => {
        const formData = new FormData()
        formData.append("file", filePreview.file)
        formData.append("type", filePreview.type)

        const response = await fetch(`${API_BASE}/upload-file`, {
          method: "POST",
          body: formData,
        })

        if (response.ok) {
          const result = await response.json()
          return result.file_id
        }
        throw new Error(`Failed to upload ${filePreview.file.name}`)
      })

      const uploadedFileIds = await Promise.all(uploadPromises)

      // Send message with file references to AI
      const aiQuery = message || "I've uploaded some files. Please analyze them."
      const response = await fetch(`${API_BASE}/rag-with-files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: aiQuery,
          file_ids: uploadedFileIds,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get AI response")
      }

      const data = await response.json()
      onAddMessage("assistant", data.response)
      playSound("receive")
      
      if (data.audio_url && isSoundEnabled) {
        try {
          const audioUrl = `${API_BASE}${data.audio_url}`
          const audio = new Audio(audioUrl)
          audio.play().catch(error => {
            console.error("Error playing audio:", error)
          })
        } catch (audioError) {
          console.error("Error loading audio:", audioError)
        }
      }

      toast({
        title: "Files Sent Successfully",
        description: `Uploaded ${files.length} file${files.length > 1 ? "s" : ""} and got AI response`,
      })
    } catch (error) {
      console.error("Error sending files:", error)
      playSound("error")
      toast({
        title: "Upload Error",
        description: "Failed to send files. Please try again.",
        variant: "destructive",
      })
      onAddMessage("assistant", "Sorry, I couldn't process your files. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card
      className={`h-[75vh] flex flex-col shadow-2xl border-0 ${
        isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"
      }`}
    >
      <ChatHeader
        isDarkMode={isDarkMode}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        fileInputRef={fileInputRef}
        onFileUpload={async (file) => {
          setIsUploading(true)
          setUploadProgress(0)

          try {
            const formData = new FormData()
            formData.append("file", file)

            const response = await fetch(`${API_BASE}/load-conversations`, {
              method: "POST",
              body: formData,
            })

            if (!response.ok) {
              throw new Error("Failed to upload chat history")
            }

            const data = await response.json()
            setUploadProgress(100)

            toast({
              title: "🎉 Success!",
              description: `Loaded ${data.total_entries} entries from chat history`,
            })

            onAddMessage("system", `📁 Loaded ${data.total_entries} entries from chat history`, false, "upload")
          } catch (error) {
            console.error("Error uploading chat history:", error)
            playSound("error")
            toast({
              title: "Upload Error",
              description: "Failed to upload chat history. Please try again.",
              variant: "destructive",
            })
          } finally {
            setIsUploading(false)
            setUploadProgress(0)
          }
        }}
      />

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          isDarkMode={isDarkMode}
          onLoadMoreHistory={loadChatHistory}
        />

        <Separator className={isDarkMode ? "bg-white/10" : "bg-black/10"} />

        <ChatInput
          onSendText={sendTextMessage}
          onSendVoice={sendVoiceMessage}
          onSendWithFiles={sendWithFiles}
          isLoading={isLoading}
          isDarkMode={isDarkMode}
          messageCount={messages.length}
        />
      </CardContent>
    </Card>
  )
}
