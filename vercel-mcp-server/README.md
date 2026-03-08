# Vercel MCP Server

_Last updated: March 6, 2026 at 8:56 AM (SAST)_

A Model Context Protocol (MCP) server that enables LLMs to interact with the Vercel API.

## Features

- **List Deployments**: View recent deployments with status, timestamps, and URLs
- **Get Deployment Details**: Retrieve comprehensive information about specific deployments
- **List Projects**: Browse all Vercel projects with their latest deployment status

## Tools

### `vercel_list_deployments`
List recent deployments with filtering options:
- Filter by project ID, status, or time range
- Support for pagination
- Markdown or JSON output formats

### `vercel_get_deployment`
Get detailed information about a specific deployment:
- Build logs and error messages
- Timestamps and duration
- Creator and metadata

### `vercel_list_projects`
List all Vercel projects:
- Project name, framework, and repository info
- Latest deployment status
- Search by project name

## Setup

### Prerequisites

- Node.js 18+
- Vercel API token (get from https://vercel.com/account/tokens)

### Installation

```bash
cd vercel-mcp-server
npm install
npm run build
```

### Configuration

Add to your `.vscode/mcp.json`:

```json
{
  "inputs": [
    {
      "id": "VERCEL_TOKEN",
      "type": "promptString",
      "description": "Vercel API token",
      "password": true
    }
  ],
  "servers": {
    "vercel": {
      "type": "stdio",
      "command": "node",
      "args": ["vercel-mcp-server/dist/index.js"],
      "env": {
        "VERCEL_TOKEN": "${input:VERCEL_TOKEN}"
      }
    }
  }
}
```

Or set the environment variable directly:

```bash
export VERCEL_TOKEN="your_vercel_token_here"
```

## Usage Examples

### List Recent Deployments

```
"Show me recent deployments"
"List failed deployments from today"
"Get production deployments for the last week"
```

### Check Deployment Status

```
"Check deployment dpl_abc123 status"
"Why did my deployment fail?"
"Get details for https://my-app-xxx.vercel.app"
```

### List Projects

```
"List all my Vercel projects"
"Show Next.js projects"
"Which projects have failed deployments?"
```

## Development

```bash
# Development with auto-reload
npm run dev

# Build
npm run build

# Clean build artifacts
npm run clean
```

## API Reference

This server uses the Vercel REST API:
- Deployments API: https://vercel.com/docs/rest-api/endpoints/deployments
- Projects API: https://vercel.com/docs/rest-api/endpoints/projects

## License

MIT
