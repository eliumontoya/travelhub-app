# Delta Spec: issue-187-settings-redirect

## Requirement: Settings save redirect confirmation

The system MUST redirect the authenticated agent to the dashboard after settings are saved successfully and MUST show a success confirmation there.

### Scenario: Successful settings save redirects to dashboard

- GIVEN an authenticated agent submits valid settings on `/dashboard/settings`
- WHEN the settings are persisted successfully
- THEN the system MUST redirect the agent to `/dashboard`
- AND the dashboard MUST show a confirmation that the settings were saved successfully

### Scenario: Failed settings save stays on settings form

- GIVEN an authenticated agent submits invalid settings or a save dependency fails
- WHEN the settings are not persisted successfully
- THEN the system MUST keep the agent on the settings form with an error message
- AND the dashboard success confirmation MUST NOT be shown
