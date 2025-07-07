# AGENTS.md

This file provides guidance to AI agents working in this repository.

## Project Overview

**A1D Agent** is a TypeScript-based AI agent framework built on Mastra that specializes in creating AI-powered video content generation, particularly "draw-out" style whiteboard explanation videos. The project uses a **plan-driven, VFS-centric architecture** where all agent behavior is guided by structured plans and artifacts are stored in an isolated Virtual File System.

## Development Commands

- `pnpm dev`: Start development server with Mastra CLI.
- `pnpm build`: Build the project.
- `pnpm start`: Start production server.
- `pnpm test`: Run all tests with Vitest.
- `pnpm test <path/to/test.ts>`: Run a specific test file.
- `pnpm typecheck`: Run TypeScript type checking.
- `pnpm format`: Format code with Prettier.
- `pnpm env:check`: Validate environment variables.

## Code Style & Conventions

- **Language**: TypeScript with strict typing.
- **Formatting**: Use Prettier (`pnpm format`).
- **Imports**: Use path aliases like `@/` for internal modules.
- **Architecture**: This is a plan-driven, VFS-centric project. All agent behavior is guided by structured plans.
- **VFS**: Use the factory `createVirtualFileSystem(projectId)` from ` '@/mastra/factory'` to interact with the Virtual File System.
- **Error Handling**: Follow existing patterns for error handling.
- **Cursor Rules**: Adhere to the strict rules in `.cursor/rules`. Only perform tasks explicitly requested by the user. Do not add, fix, or optimize code without permission.

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

- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Uses `@mastra/pg` PostgresStore for production
- **Configuration**: Database config in `drizzle.config.ts`
- **Schema**: Located in `src/server/db/`

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
- **Configuration**: `vitest.config.ts`
- **Command**: `pnpm test <path/to/test.ts>`

## Plan-Driven Architecture

All agent behavior is guided by a `plan.md` file that contains structured execution plans. Agents read and follow these plans to determine their actions and workflows.

## Environment Management

- Uses `dotenvx` for environment variable management
- Environment validation via `pnpm env:check`
- Multiple AI service API keys required (see package.json dependencies)

## Key Files to Understand

- `src/mastra/index.ts` - Main Mastra instance and agent registration
- `src/mastra/factory.ts` - Core factories for storage, logger, VFS
- `src/server/vfs/` - Virtual File System implementation
- `src/integration/` - External service integrations
- `src/mastra/agents/` - Individual agent implementations
- `src/mastra/workflows/` - Multi-step workflow definitions
