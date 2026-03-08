#!/usr/bin/env node
/**
 * MCP Server for Vercel API.
 *
 * This server provides tools to interact with the Vercel API, including listing deployments,
 * getting deployment details, and managing projects.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios, { AxiosError } from "axios";

// Constants
const API_BASE_URL = "https://api.vercel.com";
const CHARACTER_LIMIT = 25000;

// Enums
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

enum DeploymentStatus {
  BUILDING = "BUILDING",
  ERROR = "ERROR",
  INITIALIZING = "INITIALIZING",
  QUEUED = "QUEUED",
  READY = "READY",
  CANCELED = "CANCELED"
}

// Zod schemas
const ListDeploymentsInputSchema = z.object({
  projectId: z.string()
    .optional()
    .describe("Filter deployments by project ID"),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum results to return (1-100)"),
  since: z.number()
    .int()
    .optional()
    .describe("Timestamp in milliseconds to get deployments created after this time"),
  until: z.number()
    .int()
    .optional()
    .describe("Timestamp in milliseconds to get deployments created before this time"),
  status: z.nativeEnum(DeploymentStatus)
    .optional()
    .describe("Filter by deployment status: BUILDING, ERROR, INITIALIZING, QUEUED, READY, CANCELED"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetDeploymentInputSchema = z.object({
  deploymentId: z.string()
    .describe("The unique deployment ID or URL"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const ListProjectsInputSchema = z.object({
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum results to return (1-100)"),
  search: z.string()
    .optional()
    .describe("Search projects by name"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

// Type definitions
type ListDeploymentsInput = z.infer<typeof ListDeploymentsInputSchema>;
type GetDeploymentInput = z.infer<typeof GetDeploymentInputSchema>;
type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;

// Interfaces for Vercel API responses
interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  created: number;
  state: DeploymentStatus;
  readyState?: string;
  type?: string;
  source?: string;
  target?: string;
  meta?: Record<string, string>;
  projectId?: string;
  ownerId?: string;
  creator?: {
    uid: string;
    username?: string;
    email?: string;
  };
  buildingAt?: number;
  ready?: number;
  error?: {
    code: string;
    message: string;
  };
}

interface VercelProject {
  id: string;
  name: string;
  framework?: string;
  latestDeployments?: VercelDeployment[];
  createdAt?: number;
  updatedAt?: number;
  link?: {
    type?: string;
    org?: string;
    repo?: string;
    repoId?: number;
  };
}

// Shared utility functions
async function makeApiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  data?: any,
  params?: any
): Promise<T> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error("VERCEL_TOKEN environment variable is required");
  }

  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
      params,
      timeout: 30000,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          return "Error: Authentication failed. Please check your VERCEL_TOKEN is valid.";
        case 403:
          return "Error: Permission denied. You don't have access to this resource.";
        case 404:
          return "Error: Resource not found. Please check the ID is correct.";
        case 429:
          return "Error: Rate limit exceeded. Please wait before making more requests.";
        default:
          return `Error: API request failed with status ${error.response.status}: ${error.response.data?.message || error.message}`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    } else if (error.code === "ENOTFOUND") {
      return "Error: Unable to connect to Vercel API. Please check your internet connection.";
    }
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: Unexpected error occurred: ${String(error)}`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatAge(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function formatDuration(start: number, end?: number): string {
  if (!end) return "N/A";
  const diff = end - start;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function getStatusEmoji(status: DeploymentStatus): string {
  switch (status) {
    case DeploymentStatus.READY:
      return "● Ready";
    case DeploymentStatus.ERROR:
      return "● Error";
    case DeploymentStatus.BUILDING:
      return "◐ Building";
    case DeploymentStatus.INITIALIZING:
      return "○ Initializing";
    case DeploymentStatus.QUEUED:
      return "○ Queued";
    case DeploymentStatus.CANCELED:
      return "○ Canceled";
    default:
      return "○ Unknown";
  }
}

// Create MCP server instance
const server = new McpServer({
  name: "vercel-mcp-server",
  version: "1.0.0"
});

// Register tools
server.registerTool(
  "vercel_list_deployments",
  {
    title: "List Vercel Deployments",
    description: `List recent deployments from Vercel with filtering options.

This tool retrieves deployment history from your Vercel account, showing status, timestamps,
and URLs for each deployment. Use it to monitor deployment status and troubleshoot issues.

Args:
  - projectId (string, optional): Filter deployments by specific project ID
  - limit (number): Maximum results to return, 1-100 (default: 20)
  - since (number, optional): Timestamp (ms) to get deployments after this time
  - until (number, optional): Timestamp (ms) to get deployments before this time
  - status (string, optional): Filter by status - BUILDING, ERROR, INITIALIZING, QUEUED, READY, CANCELED
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with schema:
  {
    "total": number,           // Total number of deployments
    "count": number,           // Number of results in this response
    "deployments": [
      {
        "id": string,          // Deployment ID
        "url": string,         // Deployment URL
        "name": string,        // Deployment name
        "status": string,      // BUILDING, ERROR, READY, etc.
        "created": string,     // ISO timestamp
        "age": string,         // Human-readable age (e.g., "5m", "2h")
        "projectId": string,   // Associated project ID
        "target": string,      // Environment (production, preview)
        "creator": string      // Username of deployer
      }
    ]
  }

Examples:
  - "Show recent deployments" -> {limit: 10}
  - "Check failed deployments" -> {status: "ERROR", limit: 50}
  - "Get production deployments from today" -> {target: "production", since: <timestamp>}

Error Handling:
  - Returns auth error if VERCEL_TOKEN is missing or invalid
  - Returns "No deployments found" if query returns empty results`,
    inputSchema: ListDeploymentsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListDeploymentsInput) => {
    try {
      const queryParams: any = {
        limit: params.limit
      };
      
      if (params.projectId) queryParams.projectId = params.projectId;
      if (params.since) queryParams.since = params.since;
      if (params.until) queryParams.until = params.until;
      if (params.status) queryParams.state = params.status;

      const data = await makeApiRequest<{ deployments: VercelDeployment[] }>(
        "/v6/deployments",
        "GET",
        undefined,
        queryParams
      );

      const deployments = data.deployments || [];

      if (!deployments.length) {
        return {
          content: [{
            type: "text",
            text: "No deployments found matching the specified criteria."
          }]
        };
      }

      let result: string;

      if (params.response_format === ResponseFormat.MARKDOWN) {
        const lines: string[] = ["# Vercel Deployments", ""];
        lines.push(`Found ${deployments.length} deployment(s)`);
        lines.push("");
        lines.push("| Age | Status | Environment | Project | URL |");
        lines.push("|-----|--------|-------------|---------|-----|");

        for (const deployment of deployments) {
          const age = formatAge(deployment.created);
          const status = getStatusEmoji(deployment.state);
          const env = deployment.target || "preview";
          const projectName = deployment.name || deployment.projectId || "N/A";
          const url = deployment.url ? `https://${deployment.url}` : "N/A";
          
          lines.push(`| ${age} | ${status} | ${env} | ${projectName} | ${url} |`);
        }

        result = lines.join("\n");
      } else {
        const response = {
          total: deployments.length,
          count: deployments.length,
          deployments: deployments.map(d => ({
            id: d.uid,
            url: d.url ? `https://${d.url}` : null,
            name: d.name,
            status: d.state,
            created: formatTimestamp(d.created),
            age: formatAge(d.created),
            projectId: d.projectId,
            target: d.target || "preview",
            creator: d.creator?.username || d.creator?.email || "Unknown",
            buildingAt: d.buildingAt ? formatTimestamp(d.buildingAt) : null,
            readyAt: d.ready ? formatTimestamp(d.ready) : null,
            error: d.error || null
          }))
        };

        result = JSON.stringify(response, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleApiError(error)
        }]
      };
    }
  }
);

server.registerTool(
  "vercel_get_deployment",
  {
    title: "Get Vercel Deployment Details",
    description: `Get detailed information about a specific Vercel deployment.

Retrieves comprehensive details about a deployment including build logs, environment variables,
error messages, and metadata. Use this to troubleshoot failed deployments or inspect deployment configuration.

Args:
  - deploymentId (string, required): The deployment ID or URL (e.g., "dpl_123abc" or "my-app-123.vercel.app")
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Detailed deployment object with schema:
  {
    "id": string,
    "url": string,
    "name": string,
    "status": string,
    "created": string,
    "ready": string,
    "buildingAt": string,
    "target": string,
    "projectId": string,
    "creator": {
      "uid": string,
      "username": string,
      "email": string
    },
    "error": {
      "code": string,
      "message": string
    },
    "meta": object,
    "type": string
  }

Examples:
  - "Get details for deployment dpl_abc123" -> {deploymentId: "dpl_abc123"}
  - "Why did my deployment fail?" -> {deploymentId: "<failed-deployment-id>"}

Error Handling:
  - Returns 404 error if deployment ID doesn't exist
  - Returns auth error if you don't have access to the deployment`,
    inputSchema: GetDeploymentInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetDeploymentInput) => {
    try {
      // Extract deployment ID from URL if provided
      let deploymentId = params.deploymentId;
      if (deploymentId.includes(".vercel.app")) {
        // Extract from URL like https://my-app-xxx.vercel.app
        const match = deploymentId.match(/^https?:\/\/([^\.]+)\.vercel\.app/);
        if (match) {
          deploymentId = match[1];
        }
      }

      const data = await makeApiRequest<VercelDeployment>(
        `/v13/deployments/${deploymentId}`,
        "GET"
      );

      let result: string;

      if (params.response_format === ResponseFormat.MARKDOWN) {
        const lines: string[] = ["# Deployment Details", ""];
        
        lines.push(`**ID**: ${data.uid}`);
        lines.push(`**Name**: ${data.name}`);
        lines.push(`**URL**: https://${data.url}`);
        lines.push(`**Status**: ${getStatusEmoji(data.state)}`);
        lines.push(`**Created**: ${formatTimestamp(data.created)} (${formatAge(data.created)} ago)`);
        
        if (data.buildingAt) {
          lines.push(`**Build Started**: ${formatTimestamp(data.buildingAt)}`);
        }
        
        if (data.ready) {
          lines.push(`**Ready**: ${formatTimestamp(data.ready)}`);
          if (data.buildingAt) {
            lines.push(`**Build Duration**: ${formatDuration(data.buildingAt, data.ready)}`);
          }
        }
        
        lines.push(`**Target**: ${data.target || "preview"}`);
        lines.push(`**Type**: ${data.type || "N/A"}`);
        
        if (data.projectId) {
          lines.push(`**Project ID**: ${data.projectId}`);
        }
        
        if (data.creator) {
          lines.push(`**Creator**: ${data.creator.username || data.creator.email || data.creator.uid}`);
        }

        if (data.error) {
          lines.push("");
          lines.push("## Error");
          lines.push(`**Code**: ${data.error.code}`);
          lines.push(`**Message**: ${data.error.message}`);
        }

        if (data.meta && Object.keys(data.meta).length > 0) {
          lines.push("");
          lines.push("## Metadata");
          for (const [key, value] of Object.entries(data.meta)) {
            lines.push(`- **${key}**: ${value}`);
          }
        }

        result = lines.join("\n");
      } else {
        const response = {
          id: data.uid,
          url: data.url ? `https://${data.url}` : null,
          name: data.name,
          status: data.state,
          created: formatTimestamp(data.created),
          age: formatAge(data.created),
          buildingAt: data.buildingAt ? formatTimestamp(data.buildingAt) : null,
          ready: data.ready ? formatTimestamp(data.ready) : null,
          duration: data.buildingAt && data.ready 
            ? formatDuration(data.buildingAt, data.ready) 
            : null,
          target: data.target || "preview",
          type: data.type,
          projectId: data.projectId,
          creator: data.creator,
          error: data.error,
          meta: data.meta
        };

        result = JSON.stringify(response, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleApiError(error)
        }]
      };
    }
  }
);

server.registerTool(
  "vercel_list_projects",
  {
    title: "List Vercel Projects",
    description: `List all projects in your Vercel account.

Retrieves a list of all Vercel projects with their basic information including
latest deployments, framework, and repository links.

Args:
  - limit (number): Maximum results to return, 1-100 (default: 20)
  - search (string, optional): Search projects by name
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with schema:
  {
    "total": number,
    "count": number,
    "projects": [
      {
        "id": string,
        "name": string,
        "framework": string,
        "createdAt": string,
        "updatedAt": string,
        "latestDeployments": [...],
        "repo": string
      }
    ]
  }

Examples:
  - "List all my projects" -> {limit: 50}
  - "Find my Next.js projects" -> {search: "next"}

Error Handling:
  - Returns auth error if VERCEL_TOKEN is missing or invalid`,
    inputSchema: ListProjectsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListProjectsInput) => {
    try {
      const queryParams: any = {
        limit: params.limit
      };
      
      if (params.search) queryParams.search = params.search;

      const data = await makeApiRequest<{ projects: VercelProject[] }>(
        "/v9/projects",
        "GET",
        undefined,
        queryParams
      );

      const projects = data.projects || [];

      if (!projects.length) {
        return {
          content: [{
            type: "text",
            text: params.search 
              ? `No projects found matching "${params.search}".` 
              : "No projects found in your account."
          }]
        };
      }

      let result: string;

      if (params.response_format === ResponseFormat.MARKDOWN) {
        const lines: string[] = ["# Vercel Projects", ""];
        lines.push(`Found ${projects.length} project(s)`);
        lines.push("");
        lines.push("| Name | Framework | Created | Latest Deployment |");
        lines.push("|------|-----------|---------|-------------------|");

        for (const project of projects) {
          const name = project.name;
          const framework = project.framework || "N/A";
          const created = project.createdAt 
            ? formatAge(project.createdAt) 
            : "N/A";
          const latestDeployment = project.latestDeployments?.[0];
          const latestStatus = latestDeployment 
            ? `${getStatusEmoji(latestDeployment.state)} (${formatAge(latestDeployment.created)})`
            : "N/A";
          
          lines.push(`| ${name} | ${framework} | ${created} ago | ${latestStatus} |`);
        }

        result = lines.join("\n");
      } else {
        const response = {
          total: projects.length,
          count: projects.length,
          projects: projects.map(p => ({
            id: p.id,
            name: p.name,
            framework: p.framework,
            createdAt: p.createdAt ? formatTimestamp(p.createdAt) : null,
            updatedAt: p.updatedAt ? formatTimestamp(p.updatedAt) : null,
            repo: p.link ? `${p.link.org}/${p.link.repo}` : null,
            latestDeployments: (p.latestDeployments || []).map(d => ({
              id: d.uid,
              status: d.state,
              url: d.url ? `https://${d.url}` : null,
              created: formatTimestamp(d.created),
              age: formatAge(d.created)
            }))
          }))
        };

        result = JSON.stringify(response, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleApiError(error)
        }]
      };
    }
  }
);

// Main function
async function main() {
  // Verify environment variables
  if (!process.env.VERCEL_TOKEN) {
    console.error("ERROR: VERCEL_TOKEN environment variable is required");
    console.error("Get your token from: https://vercel.com/account/tokens");
    process.exit(1);
  }

  // Create transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  console.error("Vercel MCP server running via stdio");
}

// Run the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
