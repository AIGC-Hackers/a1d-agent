# Virtual File System (VFS)

A lightweight, type-safe virtual file system designed specifically for AI agents and tool-based applications. The VFS provides a simple key-value storage abstraction for files with support for multiple storage backends.

## Overview

The VFS module implements a flat file storage system where files are identified by absolute paths and stored as content strings. It's designed to be simple, efficient, and perfect for AI agents that need to read, write, and manipulate files without the complexity of a real file system.

## Architecture

```
┌─────────────────────────┐
│   VirtualFileSystem     │  ← Main API Layer
├─────────────────────────┤
│      Storage            │  ← Abstract Storage Interface
├─────────────────────────┤
│  MemoryStorage  │  PostgresStorage  │  ← Concrete Implementations
└─────────────────────────┘
```

## Features

- **Flat Storage**: Simple path → content mapping without directory hierarchies
- **Type Safety**: Full TypeScript support with structured error handling
- **Multiple Backends**: Memory and PostgreSQL storage implementations
- **Project Isolation**: Each project/thread has isolated file space
- **Rich Metadata**: Support for content types, descriptions, and custom metadata
- **Error Handling**: Structured errors with error codes and context
- **File Operations**: Read, write, delete, move, copy, and list operations

## Quick Start

### Basic Usage

```typescript
import { VirtualFileSystem } from './virtual-file-system'
import { MemoryStorage } from './memory-storage'

// Create VFS instance
const storage = new MemoryStorage('my-project')
const vfs = new VirtualFileSystem(storage)

// Write a file
await vfs.writeFile({
  path: '/hello.txt',
  content: 'Hello, World!',
  contentType: 'text/plain',
  description: 'A greeting file'
})

// Read a file
const file = await vfs.readFile('/hello.txt')
console.log(file.content) // "Hello, World!"

// List all files
const files = await vfs.listFiles()
console.log(files) // [{ path: '/hello.txt', size: 13, ... }]
```

### With Error Handling

```typescript
import { VFSError, VFSErrorCode } from './types'

try {
  const file = await vfs.readFile('/non-existent.txt')
} catch (error) {
  if (error instanceof VFSError) {
    console.log('Error code:', error.code)     // FILE_NOT_FOUND
    console.log('File path:', error.path)      // /non-existent.txt
    console.log('Message:', error.message)     // File not found: /non-existent.txt
  }
}
```

## API Reference

### VirtualFileSystem

The main class providing file system operations.

#### Constructor

```typescript
constructor(storage: Storage)
```

#### Methods

##### `writeFile(file: VFile): Promise<void>`

Write a file to the storage.

```typescript
await vfs.writeFile({
  path: '/config.json',
  content: JSON.stringify({ setting: 'value' }),
  contentType: 'application/json',
  description: 'Application configuration',
  metadata: { version: 1 }
})
```

##### `readFile(path: string): Promise<Omit<VFile, 'description'>>`

Read a file from storage. The `description` field is omitted from the return value.

```typescript
const file = await vfs.readFile('/config.json')
// file.description is not available in the returned object
```

##### `deleteFile(path: string, options?: { recursive?: boolean }): Promise<void>`

Delete a file or files matching a path prefix.

```typescript
// Delete single file
await vfs.deleteFile('/temp.txt')

// Delete all files starting with /logs/
await vfs.deleteFile('/logs', { recursive: true })
```

##### `listFiles(): Promise<FileInfo[]>`

List all files in the storage with metadata.

```typescript
const files = await vfs.listFiles()
files.forEach(file => {
  console.log(`${file.path}: ${file.size} bytes`)
})
```

##### `moveFile(fromPath: string, toPath: string): Promise<void>`

Move a file to a new path.

```typescript
await vfs.moveFile('/old-name.txt', '/new-name.txt')
```

##### `copyFile(fromPath: string, toPath: string): Promise<void>`

Copy a file to a new path.

```typescript
await vfs.copyFile('/original.txt', '/backup.txt')
```

## Types

### VFile

Represents a file in the virtual file system.

```typescript
type VFile = {
  path: string                    // Absolute path (must start with '/')
  content: string                 // File content
  contentType?: string           // MIME type (e.g., 'text/plain')
  description?: string           // Human-readable description
  metadata?: Record<string, unknown> // Custom metadata
}
```

### FileInfo

File information returned by `listFiles()`.

```typescript
interface FileInfo {
  path: string
  size: number                   // Content length in bytes
  lastModified: Date
  contentType?: string
  description?: string
  metadata?: Record<string, unknown>
}
```

### VFSError

Structured error with error codes and context.

```typescript
class VFSError extends Error {
  constructor(
    message: string,
    public code: string,
    public path?: string,
    public cause?: Error
  )
}
```

### Error Codes

```typescript
enum VFSErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',     // File does not exist
  INVALID_PATH = 'INVALID_PATH',         // Path validation failed
  OPERATION_FAILED = 'OPERATION_FAILED'  // Storage operation failed
}
```

## Storage Backends

### MemoryStorage

In-memory storage for development and testing.

```typescript
import { MemoryStorage } from './memory-storage'

const storage = new MemoryStorage('project-id')
const vfs = new VirtualFileSystem(storage)

// Clear project data
storage.clear()

// Clear all projects
MemoryStorage.clearAll()
```

**Features:**
- Fast operations
- Project isolation
- Supports all file operations
- Data lost on process restart

### PostgresStorage

Persistent storage using PostgreSQL database.

```typescript
import { PostgresStorage } from './postgres-storage'

const storage = new PostgresStorage('project-id')
const vfs = new VirtualFileSystem(storage)
```

**Features:**
- Persistent storage
- ACID transactions
- Project isolation
- Requires database setup

## Path Validation

All file paths must follow these rules:

- **Absolute paths**: Must start with `/`
- **String type**: Must be a non-empty string
- **Length limit**: Maximum 1000 characters
- **No traversal**: No `..` sequences allowed

```typescript
// ✅ Valid paths
'/file.txt'
'/folder/subfolder/document.md'
'/config/app.json'

// ❌ Invalid paths
'relative/path.txt'    // Must be absolute
''                     // Cannot be empty
'/'.repeat(1001)      // Too long
```

## Error Handling Best Practices

Always catch and handle VFS errors appropriately:

```typescript
import { VFSError, VFSErrorCode } from './types'

async function safeReadFile(vfs: VirtualFileSystem, path: string) {
  try {
    return await vfs.readFile(path)
  } catch (error) {
    if (error instanceof VFSError) {
      switch (error.code) {
        case VFSErrorCode.FILE_NOT_FOUND:
          console.log(`File ${path} does not exist`)
          return null
        
        case VFSErrorCode.INVALID_PATH:
          console.error(`Invalid path: ${path}`)
          throw error
        
        case VFSErrorCode.OPERATION_FAILED:
          console.error(`Storage error: ${error.message}`)
          throw error
        
        default:
          throw error
      }
    }
    throw error // Re-throw non-VFS errors
  }
}
```

## Integration with Tools

The VFS is designed to work seamlessly with AI agent tools:

```typescript
// In your tool implementation
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { MemoryStorage } from '@/server/vfs/memory-storage'

export const readFileTool = createTool({
  id: 'read-file',
  description: 'Read file content from VFS',
  inputSchema: z.object({
    file: z.string().describe('Absolute path of the file to read'),
  }),
  outputSchema: z.object({
    content: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context: input, threadId }) => {
    const vfs = new VirtualFileSystem(new MemoryStorage(threadId))
    
    try {
      const file = await vfs.readFile(input.file)
      return {
        content: file.content,
        success: true
      }
    } catch (error) {
      return {
        content: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },
})
```

## Testing

The VFS module includes comprehensive tests. Run them with:

```bash
pnpm test virtual-file-system.test
```

Test coverage includes:
- Path validation
- All file operations
- Error handling
- Storage backend integration
- Multi-project isolation

## Performance Considerations

### Memory Storage
- **Fast**: All operations are in-memory
- **Scalable**: Suitable for hundreds of files
- **Memory usage**: ~1KB per file + content size
- **Cleanup**: Use `clear()` or `clearAll()` to free memory

### PostgreSQL Storage
- **Persistent**: Data survives restarts
- **ACID**: Transactional consistency
- **Scalable**: Handles large numbers of files
- **Network latency**: Slower than memory storage

## Limitations

1. **File Size**: No built-in size limits (implement in your application)
2. **Binary Content**: Designed for text content (base64 encode binary data)
3. **Concurrency**: No file locking (last write wins)
4. **Versioning**: No built-in version control
5. **Permissions**: No access control (implement at application level)

## Migration Guide

If upgrading from an older version of the VFS:

1. **Error Handling**: Update error handling to use `VFSError` instead of generic errors
2. **Types**: Update type imports to use the new type definitions
3. **Storage Interface**: Ensure your custom storage implements the updated `Storage` interface
4. **Path Validation**: All paths must now be absolute and validated

## Contributing

When contributing to the VFS module:

1. **Tests**: Add tests for new features
2. **Types**: Maintain full TypeScript coverage
3. **Documentation**: Update this README for API changes
4. **Error Handling**: Use structured `VFSError` for all failures
5. **Backwards Compatibility**: Consider migration path for breaking changes

## License

Part of the A1D Agent project.