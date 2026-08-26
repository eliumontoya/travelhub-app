## ADDED Requirements

### Requirement: Approved knowledge retrieval for decisioning
The system MUST retrieve only active approved WhatsApp knowledge entries for inbound agent decisioning.

#### Scenario: Approved entries are loaded
- GIVEN Supabase configuration is available
- WHEN the decisioning module loads knowledge
- THEN only rows with `status = approved` MUST be requested
- AND the result MUST include ids, topics, questions, answers, tags, and sources needed for answer grounding

#### Scenario: Knowledge retrieval unavailable
- GIVEN Supabase configuration is missing or the read fails
- WHEN decisioning runs without explicitly supplied knowledge
- THEN the module MUST degrade to a safe empty knowledge set
- AND the final decision MUST NOT auto-answer solely from model imagination

### Requirement: Side-effect-free inbound agent decisioning
The system MUST classify inbound WhatsApp messages and return a validated structured decision without writing database rows or sending WhatsApp messages.

#### Scenario: Approved knowledge supports an answer
- GIVEN an inbound message and approved knowledge that directly answers it
- AND the model/provider returns valid structured output citing that knowledge
- WHEN the decisioning module evaluates the message
- THEN the result MUST include intent, summary, confidence, decision `auto_answer`, response text, and cited knowledge ids

#### Scenario: Knowledge is insufficient
- GIVEN an inbound message without sufficient approved knowledge
- WHEN the decisioning module evaluates the message
- THEN the result MUST use decision `needs_human`
- AND include an escalation reason
- AND MUST NOT include auto-answer text

#### Scenario: Sensitive or commercial-specific request
- GIVEN an inbound message asks for pricing, booking, payment, cancellation, refund, emergency, medical, legal, or other commercial-specific action
- WHEN the decisioning module evaluates the message
- THEN the result MUST use decision `needs_human`
- AND include an escalation reason

### Requirement: Validated conservative model output
The system MUST validate structured model/provider output before using it for inbound auto-answer decisions.

#### Scenario: Invalid structured output
- GIVEN the model/provider returns malformed JSON or values outside the allowed schema
- WHEN the decisioning module parses the output
- THEN the result MUST use decision `needs_human`
- AND include an escalation reason

#### Scenario: Low-confidence auto-answer
- GIVEN the model/provider returns `auto_answer` with confidence below the safe threshold
- WHEN the decisioning module validates the output
- THEN the result MUST be converted to `needs_human`
- AND include an escalation reason
