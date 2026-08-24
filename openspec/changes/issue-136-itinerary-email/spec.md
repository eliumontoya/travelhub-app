# Spec: Enviar itinerario por correo (issue #136)

## ADDED Requirements

### Requirement: Send itinerary by email from trip editor
The trip editor at `/dashboard/trips/[id]` SHALL provide a manual action that sends the
full itinerary of the trip by email. The agent SHALL be able to confirm or edit the
recipient list (defaulting to the assigned clients' emails) and SHALL be able to include
an optional custom message.

#### Acceptance Scenarios

```gherkin
Scenario: Agent sends the itinerary to the assigned client
  Given a trip with at least one assigned client that has an email
  When the agent opens the "Enviar por correo" dialog and submits with the default recipients
  Then an email is sent to those recipients containing the itinerary (days, items, times)
  And the email includes a link to the public view /t/[slug]

Scenario: Agent edits recipients and adds a custom message
  Given the send dialog is open
  When the agent changes the recipients field and enters a custom message
  Then the email is sent to the edited recipients
  And the custom message appears in the body of the email

Scenario: No recipients provided
  Given the send dialog is open
  When the agent clears the recipients field and submits
  Then the action returns an error and no email is sent
```

### Requirement: Graceful degradation without Resend
The send action SHALL NOT require `RESEND_API_KEY` to be present for the app to function.
When the key is missing, the action SHALL return a clear, non-crashing message indicating
email is not configured.

#### Acceptance Scenarios

```gherkin
Scenario: Resend not configured
  Given RESEND_API_KEY is not set
  When the agent submits the send dialog
  Then the action returns a failure result with a message about missing configuration
  And no exception is thrown to the UI
```

### Requirement: Cost visibility respects showCostsToClient
The email body SHALL include item costs only when the trip's `showCostsToClient` flag is
`true`.

#### Acceptance Scenarios

```gherkin
Scenario: Costs hidden by default
  Given a trip with showCostsToClient = false and items that have a cost
  When the itinerary email is rendered
  Then item costs are omitted from the body

Scenario: Costs shown when enabled
  Given a trip with showCostsToClient = true
  When the itinerary email is rendered
  Then item costs are included in the body
```
