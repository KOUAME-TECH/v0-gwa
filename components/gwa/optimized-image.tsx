"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface OptimizedImageProps {
  src: string | null | undefined
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  priority?: boolean
  sizes?: string
  placeholder?: "blur" | "empty" | "skeleton"
  fallback?: string
  onLoad?: () => void
  onError?: () => void
}

// Per spec: "Images compressees < 200Ko. Lazy loading des images. WebP obligatoire."
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className,
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  placeholder = "skeleton",
  fallback = "/images/placeholder-product.jpg",
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const imgRef = useRef<HTMLDivElement>(null)
  
  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: "100px", threshold: 0.1 }
    )
    
    observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [priority])
  
  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }
  
  const handleError = () => {
    setHasError(true)
    onError?.()
  }
  
  const imageSrc = hasError || !src ? fallback : src
  
  // Generate blur data URL for placeholder
  const blurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAYI/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBRITIQYHMUH/xAAVAQEBAAAAAAAAAAAAAAAAAAAFBv/EABsRAAICAwEAAAAAAAAAAAAAAAECABEDITFB/9oADAMBAAIRAxEAPwC4+O+m6hcaRPqGq28kFxdXEjqkibXWNSQoIPx/BUjSlVmIYkKCCQT0T9lKUyxwBj6J/9k="
  
  return (
    <div 
      ref={imgRef}
      className={cn(
        "relative overflow-hidden bg-muted",
        !fill && "inline-block",
        className
      )}
      style={!fill ? { width, height } : undefined}
    >
      {/* Skeleton placeholder */}
      {!isLoaded && placeholder === "skeleton" && (
        <div className="absolute inset-0 gwa-skeleton" />
      )}
      
      {/* Only render image when in view */}
      {isInView && (
        <Image
          src={imageSrc}
          alt={alt}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          fill={fill}
          sizes={sizes}
          priority={priority}
          quality={75} // Optimized quality for 3G
          placeholder={placeholder === "blur" ? "blur" : "empty"}
          blurDataURL={placeholder === "blur" ? blurDataURL : undefined}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            fill && "object-cover"
          )}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  )
}

// Thumbnail version - extra optimized for lists
export function Thumbnail({
  src,
  alt,
  size = 64,
  className,
}: {
  src: string | null | undefined
  alt: string
  size?: number
  className?: string
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("rounded-lg shrink-0", className)}
      sizes={`${size}px`}
    />
  )
}

// Avatar version
export function OptimizedAvatar({
  src,
  alt,
  size = 40,
  className,
  fallbackInitials,
}: {
  src: string | null | undefined
  alt: string
  size?: number
  className?: string
  fallbackInitials?: string
}) {
  const [hasError, setHasError] = useState(false)
  
  if (hasError || !src) {
    return (
      <div 
        className={cn(
          "rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-semibold",
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {fallbackInitials || alt.charAt(0).toUpperCase()}
      </div>
    )
  }
  
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("rounded-full", className)}
      sizes={`${size}px`}
      priority
      onError={() => setHasError(true)}
    />
  )
}
