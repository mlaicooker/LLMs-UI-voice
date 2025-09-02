"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, File, ImageIcon, Video, FileText, X, Loader2, CheckCircle, AlertTriangle, Send } from "lucide-react"

interface FilePreview {
  id: string
  file: File
  type: "image" | "video" | "document" | "other"
  preview?: string
  status: "ready" | "uploading" | "uploaded" | "error"
  progress: number
  backendId?: string
}

interface FileUploadPreviewProps {
  onSendWithFiles: (files: FilePreview[], message: string) => void
  onClose: () => void
  isDarkMode: boolean
  maxFiles?: number
  maxSizePerFile?: number // in MB
}

export function FileUploadPreview({
  onSendWithFiles,
  onClose,
  isDarkMode,
  maxFiles = 10,
  maxSizePerFile = 50,
}: FileUploadPreviewProps) {
  const [files, setFiles] = useState<FilePreview[]>([])
  const [message, setMessage] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getFileType = (file: File): FilePreview["type"] => {
    if (file.type.startsWith("image/")) return "image"
    if (file.type.startsWith("video/")) return "video"
    if (
      file.type.includes("pdf") ||
      file.type.includes("document") ||
      file.type.includes("text") ||
      file.type.includes("json")
    ) {
      return "document"
    }
    return "other"
  }

  const getFileIcon = (type: FilePreview["type"]) => {
    switch (type) {
      case "image":
        return <ImageIcon className="w-4 h-4" />
      case "video":
        return <Video className="w-4 h-4" />
      case "document":
        return <FileText className="w-4 h-4" />
      default:
        return <File className="w-4 h-4" />
    }
  }

  const createPreview = async (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      } else if (file.type.startsWith("video/")) {
        const video = document.createElement("video")
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        video.onloadedmetadata = () => {
          canvas.width = Math.min(video.videoWidth, 200)
          canvas.height = Math.min(video.videoHeight, 200)
          video.currentTime = 1 // Seek to 1 second for thumbnail
        }

        video.onseeked = () => {
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL())
          URL.revokeObjectURL(video.src)
        }

        video.src = URL.createObjectURL(file)
      } else {
        resolve(undefined)
      }
    })
  }

  const handleFiles = async (fileList: FileList) => {
    const newFiles: FilePreview[] = []

    for (let i = 0; i < Math.min(fileList.length, maxFiles - files.length); i++) {
      const file = fileList[i]

      // Check file size
      if (file.size > maxSizePerFile * 1024 * 1024) {
        console.warn(`File ${file.name} exceeds size limit`)
        continue
      }

      const filePreview: FilePreview = {
        id: Date.now().toString() + i,
        file,
        type: getFileType(file),
        status: "ready",
        progress: 0,
        preview: await createPreview(file),
      }

      newFiles.push(filePreview)
    }

    setFiles((prev) => [...prev, ...newFiles])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleSend = async () => {
    if (files.length === 0 && !message.trim()) return

    setIsSending(true)

    // Update all files to uploading status
    setFiles((prev) => prev.map((f) => ({ ...f, status: "uploading" as const })))

    try {
      // Simulate upload progress for each file
      for (const file of files) {
        for (let progress = 0; progress <= 100; progress += 20) {
          setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, progress } : f)))
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, status: "uploaded" as const } : f)))
      }

      // Send to parent component
      onSendWithFiles(files, message.trim())

      // Reset state
      setFiles([])
      setMessage("")
      onClose()
    } catch (error) {
      console.error("Upload error:", error)
      setFiles((prev) => prev.map((f) => ({ ...f, status: "error" as const })))
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getStatusIcon = (status: FilePreview["status"]) => {
    switch (status) {
      case "uploaded":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case "uploading":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      default:
        return null
    }
  }

  return (
    <Card className={`border-0 ${isDarkMode ? "bg-black/20 backdrop-blur-xl" : "bg-white/70 backdrop-blur-xl"} mb-4`}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
            Send Files {files.length > 0 && `(${files.length})`}
          </h4>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className={`${isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-800"}`}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            isDragOver
              ? "border-blue-500 bg-blue-50/50"
              : isDarkMode
                ? "border-white/20 bg-white/5"
                : "border-gray-300 bg-gray-50/50"
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
        >
          <Upload className={`w-6 h-6 mx-auto mb-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
          <p className={`text-sm font-medium mb-1 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
            Drop files here or click to upload
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="sm"
            disabled={files.length >= maxFiles || isSending}
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.json"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {/* File Previews */}
        {files.length > 0 && (
          <ScrollArea className="h-[200px]">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {files.map((filePreview) => (
                <div
                  key={filePreview.id}
                  className={`relative rounded-lg border overflow-hidden ${
                    isDarkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
                  }`}
                >
                  {/* Preview Image/Icon */}
                  <div className="aspect-square relative">
                    {filePreview.preview ? (
                      <img
                        src={filePreview.preview || "/placeholder.svg"}
                        alt={filePreview.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-full h-full flex items-center justify-center ${
                          isDarkMode ? "bg-white/10" : "bg-black/10"
                        }`}
                      >
                        {getFileIcon(filePreview.type)}
                      </div>
                    )}

                    {/* Status Overlay */}
                    {filePreview.status !== "ready" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        {getStatusIcon(filePreview.status)}
                      </div>
                    )}

                    {/* Progress Bar */}
                    {filePreview.status === "uploading" && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${filePreview.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Remove Button */}
                    <Button
                      onClick={() => removeFile(filePreview.id)}
                      variant="ghost"
                      size="sm"
                      disabled={isSending}
                      className="absolute top-1 right-1 w-6 h-6 p-0 bg-black/50 hover:bg-black/70 text-white"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* File Info */}
                  <div className="p-2">
                    <p className={`text-xs font-medium truncate ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                      {filePreview.file.name}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                        {formatFileSize(filePreview.file.size)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {filePreview.type}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={files.length > 0 ? "Add a caption..." : "Type a message..."}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            className={`flex-1 ${
              isDarkMode
                ? "bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                : "bg-white/50 border-black/20 text-gray-800"
            } backdrop-blur-sm`}
          />
          <Button
            onClick={handleSend}
            disabled={isSending || (files.length === 0 && !message.trim())}
            size="icon"
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Info */}
        <div className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          {files.length > 0 && (
            <span>
              {files.length} file{files.length > 1 ? "s" : ""} selected •
            </span>
          )}
          <span>
            {" "}
            Max {maxSizePerFile}MB per file • Up to {maxFiles} files
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
