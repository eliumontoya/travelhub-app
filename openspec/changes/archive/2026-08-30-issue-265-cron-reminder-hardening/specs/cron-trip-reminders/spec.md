# Cron Trip Reminders Specification

## Purpose

Defines authorization, safe configuration handling, side-effect boundaries, and documentation expectations for scheduled trip reminder execution.

## Requirements

### Requirement: Production Secret Fail-Closed

The system MUST reject scheduled trip reminder execution in production when `CRON_SECRET` is missing or blank, and MUST do so before email delivery, reminder lookup, or reminder state mutation side effects.

#### Scenario: Missing production secret blocks execution

- GIVEN the environment is production
- AND `CRON_SECRET` is unset
- WHEN the trip reminder endpoint is invoked
- THEN the response MUST be `503`
- AND no email or trip reminder data side effects MUST occur

#### Scenario: Blank production secret blocks execution

- GIVEN the environment is production
- AND `CRON_SECRET` contains only whitespace or is otherwise blank
- WHEN the trip reminder endpoint is invoked
- THEN the response MUST be `503`
- AND no email or trip reminder data side effects MUST occur

### Requirement: Configured Secret Authorization

When `CRON_SECRET` is non-blank in any environment, the system MUST require an exact `Authorization: Bearer <CRON_SECRET>` header before scheduled trip reminder execution. Missing, malformed, or wrong credentials MUST return a generic `401` and MUST NOT cause email or data side effects.

#### Scenario: Valid bearer authorizes execution

- GIVEN `CRON_SECRET` is non-blank
- AND the request includes `Authorization: Bearer <CRON_SECRET>` exactly
- WHEN the trip reminder endpoint is invoked
- THEN authorization MUST pass
- AND the request MUST proceed to the existing email configuration and trip reminder behavior

#### Scenario: Missing bearer is denied generically

- GIVEN `CRON_SECRET` is non-blank
- AND the request has no authorization header
- WHEN the trip reminder endpoint is invoked
- THEN the response MUST be a generic `401`
- AND no email or trip reminder data side effects MUST occur

#### Scenario: Wrong bearer is denied generically

- GIVEN `CRON_SECRET` is non-blank
- AND the request includes a bearer token that does not exactly match `CRON_SECRET`
- WHEN the trip reminder endpoint is invoked
- THEN the response MUST be a generic `401`
- AND no email or trip reminder data side effects MUST occur

### Requirement: Non-Production Ergonomics

Outside production, the system MAY allow scheduled trip reminder execution when `CRON_SECRET` is missing or blank, so local, development, and test workflows remain usable.

#### Scenario: Development without secret may execute

- GIVEN the environment is not production
- AND `CRON_SECRET` is missing or blank
- WHEN the trip reminder endpoint is invoked
- THEN the request MAY proceed to the existing email configuration and trip reminder behavior

### Requirement: Cron Secret Documentation

Project documentation MUST define `CRON_SECRET` as required in production and SHOULD recommend configuring it in deployed or shared non-production environments.

#### Scenario: Operator sees production guidance

- GIVEN an operator reads the environment or automation documentation
- WHEN they review cron trip reminder configuration
- THEN the docs MUST state that production requires a non-blank `CRON_SECRET`
- AND the docs SHOULD recommend it for deployed or shared environments
