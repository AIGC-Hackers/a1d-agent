# AGENTS.md

This file provides guidance to AI agents working in this repository.

## Project Overview

**A1D Agent** is a TypeScript-based AI agent framework built on Mastra that specializes in creating AI-powered video content generation, particularly "draw-out" style whiteboard explanation videos. The project uses a **plan-driven, VFS-centric architecture** where all agent behavior is guided by structured plans and artifacts are stored in an isolated Virtual File System.

## Architecture Overview

- see @docs/roadmap.md for current status and next steps.
- Task based development workflow with numbered tasks in `/src/tasks` directory.

## Task Workspace

- **Tasks Directory**: The `/src/tasks` directory serves as a workspace for complex tasks
- **Task Notes**: Feel free to create detailed notes and documentation for long-running tasks
- **ast-grep Rules**: When working with code search tasks, create YAML rule files in the task directory:
  - Generate `.yaml` files with ast-grep rules for complex searches
  - Use `ast-grep --rule src/tasks/<task-number>/rule.yaml` to execute
  - This approach is preferred over inline patterns for complex matching logic
- **Workspace Organization**: Each task can have its own subdirectory with:
  - Task notes and analysis
  - ast-grep rule files
  - Intermediate results and findings
  - Any other artifacts related to the task

## Development Commands

- `dotenvx run -- <command>`: Run a command env.
- `pnpm x path/to/script.ts`: Run ts script env.
- `pnpm test <test-name | path/to/test.ts>`: Run all tests with Vitest.
- `pnpm typecheck`: Run TypeScript type checking.
- `pnpm format`: Format code with Prettier.

## Code Style & Conventions

- **Language**: TypeScript with strict typing.
- **Formatting**: Use Prettier (`pnpm format`).
- **Imports**: Use path aliases like `@/` for internal modules.
- **Architecture**: This is a plan-driven, VFS-centric project. All agent behavior is guided by structured plans.
- **VFS**: Use the factory `createVirtualFileSystem(projectId)` from ` '@/mastra/factory'` to interact with the Virtual File System.
- **Error Handling**: Follow existing patterns for error handling.
- **Cursor Rules**: Adhere to the strict rules in `.cursor/rules`. Only perform tasks explicitly requested by the user. Do not add, fix, or optimize code without permission.

## Code Search & Analysis

- **ast-grep**: Use ast-grep for precise code searching and pattern matching when necessary. It's particularly useful for:
  - Finding specific code patterns across the codebase
  - Locating all usages of a particular function or import
  - Analyzing code structure and dependencies
  - Verifying refactoring completeness
- **Documentation**: See @docs/ast-grep.md for detailed usage instructions and examples

## Core Architecture

### Key Components

- **Agents**: Specialized AI agents for different tasks (research, content creation, video generation)
- **Workflows**: Orchestrated multi-step processes
- **Tools**: Integration with external services and APIs
- **Virtual File System (VFS)**: Isolated workspace for each project
- **Factory Pattern**: Centralized creation of storage, logger, and VFS instances

### Main Entry Point

`src/mastra/index.ts` - Contains the main Mastra instance with all agents and workflows registered

### Agent Types

- **Draw Out Agent**: Creates whiteboard-style explanation videos
- **Deep Research Agent**: Conducts comprehensive research with sub-agents for evaluation, learning extraction, and reporting
- **McKinsey Consultant Agent**: Business analysis and consulting
- **Stagehand Web Agent**: Web automation and data extraction

## Database & Storage

- **Database**: Convex `src/convex`
- **Storage**: Uses `@mastra/pg` PostgresStore for production

## External Integrations

The project integrates with numerous AI services:

- **Image Generation**: Midjourney, 302, Recraft
- **Video Generation**: Speedpainter, Minimax
- **Audio**: Text-to-Audio services
- **Research**: Google Search, web scraping
- **Storage**: AWS S3, Cloudflare R2
- **Web Automation**: Stagehand

## Testing

- **Framework**: Vitest
- **Command**: `pnpm test <path/to/test.ts>`
- **Integration Tests**: Write `.inspect.ts` files for inspection testing, Run them with `pnpm x <path/to/file.inspect.ts>`.

## Environment Management

- Uses `dotenvx run -- <command>` for environment variable management
- Environment validation via `pnpm env:check`
- Multiple AI service API keys required (see package.json dependencies)

## Key Files to Understand

- `src/mastra/index.ts` - Main Mastra instance and agent registration
- `src/lib/env.ts` - Env vars declaration, you should use `env.value.<ENV_VAR_NAME>` always.
- `src/mastra/factory.ts` - Core factories for storage, logger, VFS
- `src/server/vfs/` - Virtual File System implementation
- `src/integration/` - External service integrations
- `src/mastra/agents/` - Individual agent implementations
- `src/mastra/workflows/` - Multi-step workflow definitions

Query documents through mastra mcp
