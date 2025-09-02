"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Upload, Loader2 } from "lucide-react"

interface ChatHeaderProps {
  isDarkMode: boolean
  isUploading: boolean
  uploadProgress: number
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileUpload: (file: File) => void
}

export function ChatHeader({ isDarkMode, isUploading, uploadProgress, fileInputRef, onFileUpload }: ChatHeaderProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "application/json") {
      onFileUpload(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <CardHeader
      className={`border-b ${
        isDarkMode ? "border-white/10 bg-black/10" : "border-black/10 bg-white/30"
      } backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <CardTitle className={`text-xl ${isDarkMode ? "text-white" : "text-gray-800"}`}>AI Assistant</CardTitle>
            <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>Online • Ready to help</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`gap-2 ${
              isDarkMode
                ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploadProgress > 0 && `${uploadProgress.toFixed(0)}%`}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload History
              </>
            )}
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
        </div>
      </div>
    </CardHeader>
  )
}
