Feature/Bug to implement with TDD: Could you run all test!

I need you to implement this using Test-Driven Development. Really important - you should NOT write any code yourself. You are the coordinator between tdd-guide, coder, and code-reviewer agents. The workflow goes like this: First, the tdd-guide agent designs and writes the test cases BEFORE any implementation code exists. The tests should fail initially (RED phase). Once tests are written, hand off to the coder agent to write the minimal implementation to make tests pass (GREEN phase). Then the coder can refactor while keeping tests green (REFACTOR phase). After implementation, code-reviewer reviews both the tests AND the implementation code. If issues are found, cycle back to the appropriate agent. The tdd-guide should verify test coverage meets 80% threshold at the end. Keep your context lean - summarize outputs, don't repeat them. You orchestrate, you don't implement.


Claude polished version:

I need you to implement this feature using strict Test-Driven Development methodology. This is critically important: you must NOT write any code yourself. Your role is solely to coordinate the efforts between tdd-guide, coder, and code-reviewer agents following the Red-Green-Refactor cycle.

**Phase 1 - RED (Test First):**
Delegate to the tdd-guide agent first. The tdd-guide must design and write comprehensive test cases BEFORE any implementation exists. Tests should cover:
- Unit tests for composables/utilities
- Component tests for Vue components
- API route tests for Nitro endpoints
- Zod schema validation tests
- Edge cases (null, empty, invalid inputs, boundaries)

The tests MUST fail initially - this confirms we're testing the right behavior.

**Phase 2 - GREEN (Minimal Implementation):**
Once tdd-guide completes the test suite, hand off to the coder agent with:
- The complete test file(s) created
- Clear specification of what needs to pass
- Any mocking patterns already established

The coder writes the MINIMAL code to make all tests pass. No over-engineering.

**Phase 3 - REFACTOR:**
The coder may refactor the implementation while ensuring all tests remain green. Run tests after each refactor.

**Phase 4 - REVIEW:**
Pass both the tests AND implementation to code-reviewer. The reviewer evaluates:
- Test quality (meaningful assertions, proper isolation, edge coverage)
- Implementation quality (security, performance, patterns)
- Coverage meets 80% threshold

If issues are found, route feedback to the appropriate agent:
- Test issues → tdd-guide
- Implementation issues → coder

**Phase 5 - VERIFICATION:**
The tdd-guide agent runs final coverage report and confirms all quality gates pass.

The cycle continues until both tests and implementation are approved. Remember: you are a coordinator, not an implementer. Keep your context window lean by summarizing rather than repeating full outputs. Your job is to orchestrate the TDD workflow between tdd-guide, coder, and code-reviewer agents while ensuring the test-first discipline is maintained.
