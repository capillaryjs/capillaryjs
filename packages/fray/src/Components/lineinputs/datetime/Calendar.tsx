import {Component, h} from '../../component.js'
import type {ComponentProps, FrayChild} from '../../component.js'
import type {CivilDate} from './civilDate.js'
import {
    addCivilDays,
    addMonths,
    compareCivilDates,
    daysInMonth,
    formatCivilDate,
    parseCivilDate,
    startOfMonthDay,
} from './civilDate.js'

export interface CalendarProps extends ComponentProps {
    value: CivilDate | null
    focusedDate: CivilDate
    viewYear: number
    viewMonth: number
    min?: CivilDate | null | undefined
    max?: CivilDate | null | undefined
    today: CivilDate
    onSelect: (date: CivilDate, event: Event) => void
    onFocusedDateChange: (date: CivilDate) => void
    onViewChange: (year: number, month: number) => void
    onCancel: () => void
}

const DAY_LABELS = Array.from({length: 7}, (_, i) =>
    new Date(2026, 0, 4 + i, 12, 0, 0).toLocaleDateString(undefined, {weekday: 'short'})
)

export class Calendar extends Component<CalendarProps> {
    render(): FrayChild {
        const {
            value,
            focusedDate,
            viewYear,
            viewMonth,
            min,
            max,
            today,
            onSelect,
            onFocusedDateChange,
            onViewChange,
            onCancel,
        } = this.props

        const focusedParts = parseCivilDate(focusedDate)
        const selectedParts = value == null ? null : parseCivilDate(value)

        const monthStartDay = startOfMonthDay(viewYear, viewMonth)
        const totalDays = daysInMonth(viewYear, viewMonth)
        const rowCount = Math.ceil((monthStartDay + totalDays) / 7)

        const focusedDayId = `fray-calendar-day-${focusedDate}`

        const move = (delta: number): void => {
            const base = focusedParts ?? parseCivilDate(today)!
            const next = addCivilDays(formatCivilDate(base), delta)
            this.clampAndMove(next, viewYear, viewMonth, onFocusedDateChange, onViewChange)
        }

        const setMonth = (delta: number): void => {
            const nextMonth = addMonths(viewYear, viewMonth, delta)
            const currentFocusedParts = parseCivilDate(focusedDate)
            const baseParts = currentFocusedParts ?? parseCivilDate(today)!
            const clampedDay = Math.min(baseParts.day, daysInMonth(nextMonth.year, nextMonth.month))
            const next = formatCivilDate({
                year: nextMonth.year,
                month: nextMonth.month,
                day: clampedDay,
            })
            this.clampAndMove(next, viewYear, viewMonth, onFocusedDateChange, onViewChange)
        }

        const goToStart = (): void => {
            const next = formatCivilDate({year: viewYear, month: viewMonth, day: 1})
            this.clampAndMove(next, viewYear, viewMonth, onFocusedDateChange, onViewChange)
        }

        const goToEnd = (): void => {
            const next = formatCivilDate({year: viewYear, month: viewMonth, day: totalDays})
            this.clampAndMove(next, viewYear, viewMonth, onFocusedDateChange, onViewChange)
        }

        const rows: FrayChild[] = []
        for (let row = 0; row < rowCount; row += 1) {
            const cells: FrayChild[] = []
            for (let col = 0; col < 7; col += 1) {
                const dayNumber = row * 7 + col - monthStartDay + 1
                if (dayNumber < 1 || dayNumber > totalDays) {
                    cells.push(<td role="gridcell" key={`empty-${row}-${col}`} />)
                    continue
                }
                const parts: {year: number; month: number; day: number} = {
                    year: viewYear,
                    month: viewMonth,
                    day: dayNumber,
                }
                const date = formatCivilDate(parts)
                const isSelected = value != null && date === value
                const isToday = date === today
                const isFocused = date === focusedDate
                const isDisabled = this.isDisabledDate(date, min, max)
                const dayId = `fray-calendar-day-${date}`

                cells.push(
                    <td role="gridcell" key={date}>
                        <button
                            id={dayId}
                            type="button"
                            tabIndex={isFocused ? 0 : -1}
                            data-focused={isFocused ? 'true' : null}
                            data-day={String(dayNumber)}
                            aria-selected={isSelected ? 'true' : null}
                            aria-disabled={isDisabled ? 'true' : null}
                            data-today={isToday ? 'true' : null}
                            data-selected={isSelected ? 'true' : null}
                            disabled={isDisabled}
                            onClick={(event: MouseEvent) => {
                                if (!isDisabled) onSelect(date, event)
                            }}
                        >
                            {String(dayNumber)}
                        </button>
                    </td>,
                )
            }
            rows.push(<tr role="row" key={row}>{cells}</tr>)
        }

        const monthLabel = `${monthName(viewMonth)} ${viewYear}`

        return (
            <div className="fray-calendar">
                <div className="fray-calendar-header">
                    <button
                        type="button"
                        aria-label="Previous month"
                        onClick={() => setMonth(-1)}
                    >
                        {'<'}
                    </button>
                    <span role="heading" aria-level="3">{monthLabel}</span>
                    <button
                        type="button"
                        aria-label="Next month"
                        onClick={() => setMonth(1)}
                    >
                        {'>'}
                    </button>
                </div>
                <table
                    role="grid"
                    aria-label="Choose a date"
                    tabIndex={-1}
                    onKeyDown={(event: KeyboardEvent) => {
                        switch (event.key) {
                            case 'ArrowLeft':
                                event.preventDefault()
                                move(-1)
                                break
                            case 'ArrowRight':
                                event.preventDefault()
                                move(1)
                                break
                            case 'ArrowUp':
                                event.preventDefault()
                                move(-7)
                                break
                            case 'ArrowDown':
                                event.preventDefault()
                                move(7)
                                break
                            case 'PageUp':
                                event.preventDefault()
                                setMonth(-1)
                                break
                            case 'PageDown':
                                event.preventDefault()
                                setMonth(1)
                                break
                            case 'Home':
                                event.preventDefault()
                                goToStart()
                                break
                            case 'End':
                                event.preventDefault()
                                goToEnd()
                                break
                            case 'Enter':
                            case ' ':
                                event.preventDefault()
                                if (!this.isDisabledDate(focusedDate, min, max)) {
                                    const fakeEvent = new MouseEvent('click', {bubbles: true})
                                    onSelect(focusedDate, fakeEvent)
                                }
                                break
                            case 'Escape':
                                event.preventDefault()
                                onCancel()
                                break
                        }
                    }}
                >
                    <thead>
                        <tr role="row">
                            {DAY_LABELS.map((label) => (
                                <th scope="col" role="columnheader" key={label}>
                                    <span aria-label={fullDayName(label)}>{label}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
            </div>
        )
    }

    private isDisabledDate(
        date: CivilDate,
        min: CivilDate | null | undefined,
        max: CivilDate | null | undefined,
    ): boolean {
        if (min != null && compareCivilDates(date, min) < 0) return true
        if (max != null && compareCivilDates(date, max) > 0) return true
        return false
    }

    private clampAndMove(
        next: CivilDate,
        viewYear: number,
        viewMonth: number,
        onFocusedDateChange: (date: CivilDate) => void,
        onViewChange: (year: number, month: number) => void,
    ): void {
        const parts = parseCivilDate(next)!
        if (parts.year !== viewYear || parts.month !== viewMonth) {
            onViewChange(parts.year, parts.month)
        }
        onFocusedDateChange(next)
    }

    static override css = ''
}

function monthName(month: number): string {
    return new Date(2026, month - 1, 15, 12, 0, 0).toLocaleDateString(undefined, {month: 'long'})
}

function fullDayName(short: string): string {
    const index = DAY_LABELS.indexOf(short)
    if (index === -1) return short
    return new Date(2026, 0, 4 + index, 12, 0, 0).toLocaleDateString(undefined, {weekday: 'long'})
}
