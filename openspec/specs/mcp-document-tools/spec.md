# MCP Document Tools Specification

## Purpose

Expose TravelHub's document domain to an external agent through the MCP server. The tool lets an agent obtain a presigned PUT upload URL for a document path, signed with the Supabase service role so the URL is valid for the private documents bucket.

## Requirements

### Requirement: Direct data-layer access under the service-role gate

The tool MUST invoke the TravelHub data layer directly and MUST NOT pass an injected Supabase client or rely on any request-scoped client store. The MCP route's service-role gate MUST prevent the document tool from executing when the service role is absent, so the document tool MUST NOT operate against in-memory mock data.

#### Scenario: Mock data never reachable

- GIVEN the Supabase service role is not configured
- WHEN the agent invokes the document tool
- THEN the request is rejected with HTTP 503 before the tool executes
- AND no mock-data read or mutation occurs

### Requirement: Structured success/error envelope

The document tool's results MUST use a structured success/error envelope. Successful payloads MUST be returned as a JSON-encoded text content block. Unexpected failures MUST return a sanitized message and MUST NOT expose stack traces, database identifiers, or service-role credentials.

#### Scenario: Unexpected error is sanitized

- GIVEN the document tool fails for an unexpected reason
- WHEN the server returns the error result
- THEN the result contains a sanitized message
- AND no stack trace or credential is exposed

### Requirement: Get document upload URL

The `get_document_upload_url` tool MUST return a service-role-signed presigned PUT URL for the caller-supplied document `path` in the private documents bucket, together with an `expiresIn` value defaulting to `300` seconds. The returned URL MUST allow the agent to upload file bytes via an HTTP PUT to that path.

#### Scenario: Obtain a presigned upload URL

- GIVEN a known document `path` and a configured service role
- WHEN the agent calls `get_document_upload_url` with that `path`
- THEN the result contains an `uploadUrl`
- AND the result contains `expiresIn` defaulting to `300`

#### Scenario: Upload via the returned URL

- GIVEN an `uploadUrl` returned by `get_document_upload_url`
- WHEN the agent issues an HTTP PUT with the file bytes to that URL
- THEN the file is written to the documents bucket at the requested path

#### Scenario: Custom expiry

- GIVEN the agent supplies an `expiresIn` argument
- WHEN the agent calls `get_document_upload_url` with that argument
- THEN the result reports the caller-supplied `expiresIn`
