"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

interface AudioPlayerProps {
  audioUrl: string
  isDarkMode: boolean
  autoPlay?: boolean
}

export function AudioPlayer({ audioUrl, isDarkMode, autoPlay = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const setAudioData = () => {
      setDuration(audio.duration)
      setCurrentTime(audio.currentTime)
    }

    const setAudioTime = () => setCurrentTime(audio.currentTime)

    audio.addEventListener("loadeddata", setAudioData)
    audio.addEventListener("timeupdate", setAudioTime)
    audio.addEventListener("ended", () => setIsPlaying(false))

    // Auto play if requested
    if (autoPlay) {
      audio.play().then(() => setIsPlaying(true)).catch(console.error)
    }

    return () => {
      audio.removeEventListener("loadeddata", setAudioData)
      audio.removeEventListener("timeupdate", setAudioTime)
      audio.removeEventListener("ended", () => setIsPlaying(false))
    }
  }, [audioUrl, autoPlay])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error)
    }
  }

  const handleProgressChange = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const newTime = (value[0] / 100) * duration
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = volume
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${
      isDarkMode ? "bg-white/5 border border-white/10" : "bg-black/5 border border-black/10"
    }`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <Button
        onClick={togglePlayPause}
        size="sm"
        variant="outline"
        className={`${
          isDarkMode 
            ? "border-white/20 bg-white/5 text-white hover:bg-white/10" 
            : "border-black/20 bg-black/5 text-gray-700 hover:bg-black/10"
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>

      <div className="flex-1 space-y-1">
        <Progress 
          value={duration ? (currentTime / duration) * 100 : 0} 
          className="h-2 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const percent = ((e.clientX - rect.left) / rect.width) * 100
            handleProgressChange([percent])
          }}
        />
        <div className={`flex justify-between text-xs ${
          isDarkMode ? "text-gray-400" : "text-gray-600"
        }`}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <Button
        onClick={toggleMute}
        size="sm"
        variant="ghost"
        className={`${
          isDarkMode ? "text-white hover:bg-white/10" : "text-gray-700 hover:bg-black/10"
        }`}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </Button>
    </div>
  )
}
