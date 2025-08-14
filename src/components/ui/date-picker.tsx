
"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePicker({
    date,
    setDate,
    className
}: {
    date: Date | undefined,
    setDate: (date: Date | undefined) => void,
    className?: string
}) {
  const [inputValue, setInputValue] = React.useState<string>("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [inputError, setInputError] = React.useState<string>("")
  const [isInitialized, setIsInitialized] = React.useState(false)

  // Initialize input value only once when component loads
  React.useEffect(() => {
    if (!isInitialized) {
      if (date && isValid(date)) {
        setInputValue(format(date, "MM/dd/yyyy"))
      } else {
        setInputValue("")
      }
      setIsInitialized(true)
    }
  }, [date, isInitialized])

  // Parse manually entered date with flexible parsing
  const handleInputChange = (value: string) => {
    setInputValue(value)
    setInputError("")

    if (!value.trim()) {
      setDate(undefined)
      return
    }

    // Try to parse the date with a more robust approach
    let parsedDate: Date | undefined = undefined

    // Clean up the input
    const cleanValue = value.trim()
    
    // Try common date formats with date-fns
    const formats = [
      "yyyy-MM-dd",     // 2024-01-15
      "yyyy-M-d",       // 2024-1-5
      "MM/dd/yyyy",     // 01/15/2024
      "M/d/yyyy",       // 1/5/2024
      "MM-dd-yyyy",     // 01-15-2024, 09-22-2005
      "M-d-yyyy",       // 1-5-2024
      "dd/MM/yyyy",     // 15/01/2024 (European)
      "d/M/yyyy",       // 5/1/2024 (European)
      "dd-MM-yyyy",     // 15-01-2024
      "d-M-yyyy",       // 5-1-2024
      "yyyy/MM/dd",     // 2024/01/15
      "yyyy/M/d",       // 2024/1/5
      "yyyy.MM.dd",     // 2024.01.15
      "yyyy.M.d",       // 2024.1.5
      "MM.dd.yyyy",     // 01.15.2024
      "M.d.yyyy",       // 1.5.2024
    ]

    // Try parsing with each format (create UTC dates to avoid timezone shifts)
    for (const formatStr of formats) {
      try {
        const parsed = parse(cleanValue, formatStr, new Date())
        if (isValid(parsed)) {
          // Convert to UTC to avoid timezone shifts
          const utcDate = new Date(Date.UTC(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate()
          ))
          parsedDate = utcDate
          break
        }
      } catch (error) {
        // Continue trying other formats
      }
    }

    // If date-fns parsing failed, try manual parsing for common patterns
    if (!parsedDate && cleanValue) {
      // Try MM-DD-YYYY pattern manually (create UTC date to avoid timezone shifts)
      const mmddyyyy = cleanValue.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
      if (mmddyyyy) {
        const [, month, day, year] = mmddyyyy
        const testDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)))
        if (testDate.getUTCFullYear() == parseInt(year) && 
            testDate.getUTCMonth() == parseInt(month) - 1 && 
            testDate.getUTCDate() == parseInt(day)) {
          parsedDate = testDate
        }
      }
      
      // Try MM/DD/YYYY pattern manually (create UTC date to avoid timezone shifts)
      if (!parsedDate) {
        const mmddyyyy2 = cleanValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (mmddyyyy2) {
          const [, month, day, year] = mmddyyyy2
          const testDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)))
          if (testDate.getUTCFullYear() == parseInt(year) && 
              testDate.getUTCMonth() == parseInt(month) - 1 && 
              testDate.getUTCDate() == parseInt(day)) {
            parsedDate = testDate
          }
        }
      }
    }

    if (parsedDate) {
      setDate(parsedDate)
      setInputError("")
    } else {
      setInputError("Invalid date format. Try: MM/DD/YYYY, MM-DD-YYYY, etc.")
    }
  }

  // Handle calendar selection
  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
    if (selectedDate && isValid(selectedDate)) {
      setInputValue(format(selectedDate, "MM/dd/yyyy"))
    } else {
      setInputValue("")
    }
    setInputError("")
    setIsOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Enter date (MM/DD/YYYY or MM-DD-YYYY)"
          className={cn(
            "flex-1",
            inputError && "border-destructive focus:border-destructive",
            className
          )}
        />
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              type="button"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleCalendarSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {inputError && (
        <p className="text-sm text-destructive">{inputError}</p>
      )}
    </div>
  )
}
