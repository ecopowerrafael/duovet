import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function DateTimePicker({ date, setDate, label }) {
  const parseIncomingDate = React.useCallback((value) => {
    if (!value || typeof value !== "string") return undefined
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return undefined
    return parsed
  }, [])
  const [selectedDate, setSelectedDate] = React.useState(parseIncomingDate(date))
  const [hour, setHour] = React.useState(() => {
    const parsed = parseIncomingDate(date)
    return parsed ? String(parsed.getHours()).padStart(2, "0") : "09"
  })
  const [minute, setMinute] = React.useState(() => {
    const parsed = parseIncomingDate(date)
    return parsed ? String(parsed.getMinutes()).padStart(2, "0") : "00"
  })

  const hourOptions = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")),
    []
  )
  const minuteOptions = React.useMemo(
    () => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")),
    []
  )

  React.useEffect(() => {
    const parsed = parseIncomingDate(date)
    if (!parsed) return
    setSelectedDate(parsed)
    setHour(String(parsed.getHours()).padStart(2, "0"))
    setMinute(String(parsed.getMinutes()).padStart(2, "0"))
  }, [date, parseIncomingDate])

  React.useEffect(() => {
    if (selectedDate) {
      const newDate = new Date(selectedDate)
      newDate.setHours(Number(hour))
      newDate.setMinutes(Number(minute))
      newDate.setSeconds(0)
      newDate.setMilliseconds(0)
      const year = newDate.getFullYear()
      const month = String(newDate.getMonth() + 1).padStart(2, "0")
      const day = String(newDate.getDate()).padStart(2, "0")
      const value = `${year}-${month}-${day}T${hour}:${minute}`
      setDate(value)
    }
  }, [selectedDate, hour, minute, setDate])

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex flex-col gap-2 lg:flex-row">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal rounded-xl h-11 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-[var(--accent)]" />
              {selectedDate ? (
                format(selectedDate, "PPP", { locale: ptBR })
              ) : (
                <span>Selecione a data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 rounded-2xl border-[var(--border-color)] !bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl z-[100]"
            align="start"
            side="bottom"
            sideOffset={8}
            style={{ backgroundColor: "var(--bg-card, hsl(var(--card)))", opacity: 1 }}
          >
            <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden p-1" style={{ backgroundColor: "var(--bg-card, hsl(var(--card)))", opacity: 1 }}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                locale={ptBR}
                className="rounded-2xl bg-[var(--bg-card)] text-[var(--text-primary)]"
                style={{ backgroundColor: "var(--bg-card, hsl(var(--card)))", opacity: 1 }}
                classNames={{
                  nav_button: "h-7 w-7 rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-0 opacity-100 hover:bg-[var(--bg-secondary)]",
                  day: "h-8 w-8 p-0 font-normal rounded-md hover:bg-[var(--bg-tertiary)]",
                  head_cell: "w-8 rounded-md text-[var(--text-muted)] font-medium text-[0.8rem]"
                }}
              />
            </div>
          </PopoverContent>
        </Popover>

        <div className="relative w-full lg:w-[220px] shrink-0">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--accent)] pointer-events-none" />
          <div className="grid grid-cols-2 gap-2 pl-9">
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger className="w-full min-w-0 rounded-xl h-11 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] px-2">
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent className="z-[120] border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]">
                {hourOptions.map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={minute} onValueChange={setMinute}>
              <SelectTrigger className="w-full min-w-0 rounded-xl h-11 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] px-2">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent className="z-[120] border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]">
                {minuteOptions.map((value) => (
                  <SelectItem key={value} value={value}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
