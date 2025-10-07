"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Toast stacking configuration
      visibleToasts={4}      // Show maximum 4 toasts at once
      expand={true}          // Allow expanding on hover
      richColors            // Enable rich color scheme
      closeButton={true}     // Add close button to each toast
      // Positioning and behavior
      gap={8}               // 8px gap between toasts
      offset={16}           // 16px offset from screen edge
      // Toast duration and behavior
      toastOptions={{
        duration: 4000,      // Default 4 seconds (longer than current)
        style: {
          minWidth: '320px',  // Fixed minimum width (longer than current)
          maxWidth: '480px',  // Maximum width for very long messages
          wordWrap: 'break-word',
          padding: '12px 16px',
        },
        // Custom close button styling
        classNames: {
          closeButton: 'bg-white/10 hover:bg-white/20 border-0 right-2 top-2 w-6 h-6 flex items-center justify-center rounded-full transition-colors',
          title: 'text-sm font-medium',
          description: 'text-sm opacity-90',
          toast: 'backdrop-blur-sm shadow-lg border border-white/20',
          success: 'bg-green-500/90 text-white border-green-400/30',
          error: 'bg-red-500/90 text-white border-red-400/30',
          info: 'bg-blue-500/90 text-white border-blue-400/30',
          warning: 'bg-yellow-500/90 text-white border-yellow-400/30',
        }
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "rgb(34 197 94 / 0.9)",
          "--success-text": "white",
          "--error-bg": "rgb(239 68 68 / 0.9)",
          "--error-text": "white",
          "--info-bg": "rgb(59 130 246 / 0.9)",
          "--info-text": "white",
          "--warning-bg": "rgb(234 179 8 / 0.9)",
          "--warning-text": "white",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
