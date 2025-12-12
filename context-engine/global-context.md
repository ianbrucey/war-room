# Universal Global Project Context

## Problem Definition & Scope
<!-- Define the overall problem this project solves and its boundaries -->
**Problem Statement**: [Describe the core problem your project addresses]

**Project Scope**: [Define what is and isn't included in this project]

**Target Users**: [Who will use this system]

**Success Metrics**: [How you'll measure project success]

## Solution Architecture
<!-- High-level architectural decisions and patterns -->
**Architecture Pattern**: [e.g., MVC, microservices, serverless, etc.]

**Technology Stack**:
- Frontend: [Framework/library]
- Backend: [Framework/language]
- Database: [Type and specific technology]
- Infrastructure: [Cloud provider, deployment strategy]

**Key Architectural Decisions**:
- [Decision 1]: [Rationale]
- [Decision 2]: [Rationale]
- [Decision 3]: [Rationale]

## Module Breakdown & Responsibilities
<!-- High-level module structure and their purposes -->
**Core Modules**:
1. **[Module Name]**: [Purpose and responsibilities]
2. **[Module Name]**: [Purpose and responsibilities]
3. **[Module Name]**: [Purpose and responsibilities]

**Integration Points**: [How modules communicate]

**Shared Dependencies**: [Common libraries, services, or utilities]

## Project Acceptance Criteria
<!-- Overall project completion criteria -->
- [ ] [High-level functional requirement]
- [ ] [Performance requirement]
- [ ] [Security requirement]
- [ ] [Scalability requirement]
- [ ] [Maintainability requirement]

## Key Constraints & Guidelines
**Technical Constraints**:
- [Constraint 1]: [Reason]
- [Constraint 2]: [Reason]

**Business Constraints**:
- [Timeline constraint]
- [Budget constraint]
- [Resource constraint]

**Coding Standards**:
- See the `context-engine/standards` directory for detailed coding standards.

## Architectural & Coding Standards
**Mandatory Adherence**: Before writing or modifying any code, you **MUST** consult the documents within the `context-engine/standards/` directory. These documents define the mandatory coding standards, design patterns, and architectural guidelines for this project.

- **Adherence is not optional.**
- If a standard for a specific situation is not defined, you must follow the established conventions in the existing codebase.
- The standards directory is the single source of truth for all coding and architectural decisions.

## Context Engineering Workflow
When assigned a new task, AI assistants should:

1. **Create Task Workspace**: Establish dedicated task folder with persistent context
2. **Reference Global Context**: Always start by reviewing this document
3. **Select Template**: Choose appropriate task template based on complexity
   - Simple tasks (< 2 hours): Use simple task template
   - Complex tasks (> 2 hours): Use complex task template
   - Research tasks: Use research template
4. **Gather Domain Context**: Apply relevant domain-specific knowledge
5. **Structure Planning**: Follow Problem → Solution → Rationale → Research → Plan
6. **Maintain Task State**: Track progress, decisions, and context across sessions
7. **Document Decisions**: Update decision logs during implementation
8. **Suggest Testing**: Always recommend testing after implementation

## Task Workspace System
**Task Folder Structure**: `.contx/tasks/task-[ID]-[brief-description]/`
- Each task gets a dedicated workspace for context persistence
- Maintains state across multiple work sessions
- Includes progress tracking, decision logs, and next steps
- Links to related code files and dependencies

## Available Templates & Contexts
**Task Templates**:
- Simple Task Template: For straightforward implementations
- Complex Task Template: For multi-step architectural changes
- Research Template: For investigation and discovery tasks

**Domain Contexts**: Automatically applied based on task relevance:
- Authentication & authorization
- Database operations
- API design
- Frontend components
- [Add your domain areas]

## Decision History
<!-- Track major architectural decisions made during development -->
**[Date]**: [Decision made] - [Rationale] - [Impact]

## Notes & Updates
<!-- Space for ongoing notes and context updates -->
**Last Updated**: [Date]
**Updated By**: [Person/Role]
**Changes**: [What was changed and why]

---

## Tool-Specific Instructions

### For Augment Users
- Reference this context with @global-context
- Use @simple-task-template, @complex-task-template, or @research-template
- Domain contexts will auto-trigger based on keywords

### For Warp Users
- This context is automatically applied via WARP.md
- Subdirectory-specific rules provide additional context
- All terminal AI interactions include this guidance

### For Gemini CLI Users
- This context is loaded via GEMINI.md
- Context hierarchy provides progressive detail
- Memory management preserves conversation context

### Universal Guidelines
- Always include explicit acceptance criteria
- Document architectural decisions in decision logs
- Consider forward compatibility and technical debt
- Update context documents when making architectural changes
- Use task management tools for complex multi-step work
- Suggest writing/updating tests after code changes
