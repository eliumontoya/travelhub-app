# Calendar Export Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Generate iCalendar files so travelers can add itinerary items or complete trips to personal calendars.

## Requirements

### Requirement: Item calendar export

The system MUST generate a valid `.ics` calendar containing one event for a selected itinerary item with summary, start, end, location, confirmation, and notes when available.

#### Scenario: Export item with explicit times

- GIVEN an itinerary item has date, start time, end time, title, location, and notes
- WHEN the traveler downloads the item calendar file
- THEN the `.ics` MUST contain one VEVENT with matching details

#### Scenario: Export item without explicit end time

- GIVEN an itinerary item has a start time but no end time
- WHEN the `.ics` is generated
- THEN the event end time SHOULD default to one hour after the start time

### Requirement: Full trip calendar export

The system MUST generate a valid `.ics` calendar containing one event for every item across every itinerary day.

#### Scenario: Export complete trip

- GIVEN a published trip has multiple days and items
- WHEN the traveler downloads the full trip calendar
- THEN the `.ics` MUST contain all item events in one VCALENDAR

### Requirement: Calendar file safety

The system MUST escape calendar text fields and download files as `text/calendar;charset=utf-8`.

#### Scenario: Escape special characters

- GIVEN item text contains commas, semicolons, backslashes, or newlines
- WHEN the `.ics` is generated
- THEN those characters MUST be escaped according to the app calendar exporter behavior
