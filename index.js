import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const app = express();
app.use(express.json());

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

async function ghlRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "Version": "2021-07-28"
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${GHL_API_BASE}${path}`, options);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function createServer() {
  const server = new McpServer({
    name: "ghl-mcp-server",
    version: "1.0.0"
  });

  // CONTACTS
  server.tool("search_contacts", "Search GHL contacts by name, email, or phone", {
    query: z.string().describe("Name, email, or phone to search")
  }, async ({ query }) => {
    const data = await ghlRequest("GET", `/contacts/?locationId=${LOCATION_ID}&query=${encodeURIComponent(query)}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_contact", "Get a single GHL contact by ID", {
    contactId: z.string().describe("The contact ID")
  }, async ({ contactId }) => {
    const data = await ghlRequest("GET", `/contacts/${contactId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("create_contact", "Create a new contact in GHL", {
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    companyName: z.string().optional(),
    tags: z.array(z.string()).optional()
  }, async (params) => {
    const data = await ghlRequest("POST", `/contacts/`, { ...params, locationId: LOCATION_ID });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("update_contact", "Update an existing GHL contact", {
    contactId: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    companyName: z.string().optional(),
    tags: z.array(z.string()).optional()
  }, async ({ contactId, ...params }) => {
    const data = await ghlRequest("PUT", `/contacts/${contactId}`, params);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("delete_contact", "Delete a GHL contact by ID", {
    contactId: z.string()
  }, async ({ contactId }) => {
    const data = await ghlRequest("DELETE", `/contacts/${contactId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("add_contact_tags", "Add tags to a GHL contact", {
    contactId: z.string(),
    tags: z.array(z.string())
  }, async ({ contactId, tags }) => {
    const data = await ghlRequest("POST", `/contacts/${contactId}/tags`, { tags });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("remove_contact_tags", "Remove tags from a GHL contact", {
    contactId: z.string(),
    tags: z.array(z.string())
  }, async ({ contactId, tags }) => {
    const data = await ghlRequest("DELETE", `/contacts/${contactId}/tags`, { tags });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_contact_notes", "Get notes for a GHL contact", {
    contactId: z.string()
  }, async ({ contactId }) => {
    const data = await ghlRequest("GET", `/contacts/${contactId}/notes`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("add_contact_note", "Add a note to a GHL contact", {
    contactId: z.string(),
    body: z.string().describe("The note content")
  }, async ({ contactId, body }) => {
    const data = await ghlRequest("POST", `/contacts/${contactId}/notes`, { body, userId: "" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_contact_tasks", "Get tasks for a GHL contact", {
    contactId: z.string()
  }, async ({ contactId }) => {
    const data = await ghlRequest("GET", `/contacts/${contactId}/tasks`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("create_contact_task", "Create a task for a GHL contact", {
    contactId: z.string(),
    title: z.string(),
    dueDate: z.string().describe("ISO date string"),
    description: z.string().optional()
  }, async ({ contactId, ...params }) => {
    const data = await ghlRequest("POST", `/contacts/${contactId}/tasks`, params);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_contact_appointments", "Get appointments for a GHL contact", {
    contactId: z.string()
  }, async ({ contactId }) => {
    const data = await ghlRequest("GET", `/contacts/${contactId}/appointments`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // PIPELINES AND OPPORTUNITIES
  server.tool("get_pipelines", "Get all pipelines in GHL", {}, async () => {
    const data = await ghlRequest("GET", `/opportunities/pipelines?locationId=${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("search_opportunities", "Search GHL opportunities/deals", {
    pipelineId: z.string().optional(),
    stageId: z.string().optional(),
    status: z.enum(["open", "won", "lost", "abandoned"]).optional(),
    query: z.string().optional()
  }, async (params) => {
    let qs = `locationId=${LOCATION_ID}`;
    if (params.pipelineId) qs += `&pipelineId=${params.pipelineId}`;
    if (params.stageId) qs += `&stageId=${params.stageId}`;
    if (params.status) qs += `&status=${params.status}`;
    if (params.query) qs += `&query=${encodeURIComponent(params.query)}`;
    const data = await ghlRequest("GET", `/opportunities/search?${qs}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_opportunity", "Get a single GHL opportunity by ID", {
    opportunityId: z.string()
  }, async ({ opportunityId }) => {
    const data = await ghlRequest("GET", `/opportunities/${opportunityId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("create_opportunity", "Create a new opportunity in GHL", {
    pipelineId: z.string(),
    stageId: z.string(),
    contactId: z.string(),
    name: z.string(),
    status: z.enum(["open", "won", "lost", "abandoned"]).optional(),
    monetaryValue: z.number().optional()
  }, async (params) => {
    const data = await ghlRequest("POST", `/opportunities/`, { ...params, locationId: LOCATION_ID });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("update_opportunity", "Update an existing GHL opportunity", {
    opportunityId: z.string(),
    stageId: z.string().optional(),
    status: z.enum(["open", "won", "lost", "abandoned"]).optional(),
    monetaryValue: z.number().optional(),
    name: z.string().optional()
  }, async ({ opportunityId, ...params }) => {
    const data = await ghlRequest("PUT", `/opportunities/${opportunityId}`, params);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("delete_opportunity", "Delete a GHL opportunity", {
    opportunityId: z.string()
  }, async ({ opportunityId }) => {
    const data = await ghlRequest("DELETE", `/opportunities/${opportunityId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("update_opportunity_stage", "Move a GHL opportunity to a different pipeline stage", {
    opportunityId: z.string(),
    stageId: z.string()
  }, async ({ opportunityId, stageId }) => {
    const data = await ghlRequest("PUT", `/opportunities/${opportunityId}`, { stageId });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // CONVERSATIONS AND MESSAGES
  server.tool("search_conversations", "Search GHL conversations", {
    contactId: z.string().optional(),
    query: z.string().optional()
  }, async (params) => {
    let qs = `locationId=${LOCATION_ID}`;
    if (params.contactId) qs += `&contactId=${params.contactId}`;
    if (params.query) qs += `&query=${encodeURIComponent(params.query)}`;
    const data = await ghlRequest("GET", `/conversations/search?${qs}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_conversation", "Get a single GHL conversation by ID", {
    conversationId: z.string()
  }, async ({ conversationId }) => {
    const data = await ghlRequest("GET", `/conversations/${conversationId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_conversation_messages", "Get messages in a GHL conversation", {
    conversationId: z.string()
  }, async ({ conversationId }) => {
    const data = await ghlRequest("GET", `/conversations/${conversationId}/messages`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("send_sms", "Send an SMS message via GHL", {
    contactId: z.string(),
    message: z.string()
  }, async ({ contactId, message }) => {
    const data = await ghlRequest("POST", `/conversations/messages`, {
      type: "SMS", contactId, message, locationId: LOCATION_ID
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("send_email", "Send an email via GHL", {
    contactId: z.string(),
    subject: z.string(),
    body: z.string(),
    html: z.string().optional()
  }, async ({ contactId, subject, body, html }) => {
    const data = await ghlRequest("POST", `/conversations/messages`, {
      type: "Email", contactId, subject, body, html: html || body, locationId: LOCATION_ID
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // CALENDARS AND APPOINTMENTS
  server.tool("get_calendars", "Get all calendars in GHL", {}, async () => {
    const data = await ghlRequest("GET", `/calendars/?locationId=${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_appointments", "Get appointments in a GHL calendar", {
    calendarId: z.string(),
    startTime: z.string().describe("ISO date string"),
    endTime: z.string().describe("ISO date string")
  }, async ({ calendarId, startTime, endTime }) => {
    const data = await ghlRequest("GET", `/calendars/${calendarId}/appointments?startTime=${startTime}&endTime=${endTime}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_appointment", "Get a single GHL appointment by ID", {
    appointmentId: z.string()
  }, async ({ appointmentId }) => {
    const data = await ghlRequest("GET", `/calendars/appointments/${appointmentId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("create_appointment", "Create an appointment in GHL", {
    calendarId: z.string(),
    contactId: z.string(),
    startTime: z.string().describe("ISO date string"),
    endTime: z.string().describe("ISO date string"),
    title: z.string().optional(),
    notes: z.string().optional()
  }, async (params) => {
    const data = await ghlRequest("POST", `/calendars/appointments`, { ...params, locationId: LOCATION_ID });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("update_appointment", "Update a GHL appointment", {
    appointmentId: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    title: z.string().optional(),
    notes: z.string().optional(),
    status: z.string().optional()
  }, async ({ appointmentId, ...params }) => {
    const data = await ghlRequest("PUT", `/calendars/appointments/${appointmentId}`, params);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("delete_appointment", "Delete a GHL appointment", {
    appointmentId: z.string()
  }, async ({ appointmentId }) => {
    const data = await ghlRequest("DELETE", `/calendars/appointments/${appointmentId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // WORKFLOWS
  server.tool("get_workflows", "Get all workflows in GHL", {}, async () => {
    const data = await ghlRequest("GET", `/workflows/?locationId=${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("trigger_workflow", "Add a contact to a GHL workflow", {
    workflowId: z.string(),
    contactId: z.string(),
    eventStartTime: z.string().optional().describe("ISO date string")
  }, async ({ workflowId, contactId, eventStartTime }) => {
    const body = { contactId };
    if (eventStartTime) body.eventStartTime = eventStartTime;
    const data = await ghlRequest("POST", `/workflows/${workflowId}/subscribe`, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("remove_from_workflow", "Remove a contact from a GHL workflow", {
    workflowId: z.string(),
    contactId: z.string()
  }, async ({ workflowId, contactId }) => {
    const data = await ghlRequest("DELETE", `/workflows/${workflowId}/subscribe/${contactId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // CAMPAIGNS
  server.tool("get_campaigns", "Get all campaigns in GHL", {
    status: z.string().optional()
  }, async ({ status }) => {
    let qs = `locationId=${LOCATION_ID}`;
    if (status) qs += `&status=${status}`;
    const data = await ghlRequest("GET", `/campaigns/?${qs}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // FORMS
  server.tool("get_forms", "Get all forms in GHL", {}, async () => {
    const data = await ghlRequest("GET", `/forms/?locationId=${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_form_submissions", "Get submissions for a GHL form", {
    formId: z.string(),
    startAt: z.string().optional(),
    endAt: z.string().optional()
  }, async ({ formId, startAt, endAt }) => {
    let qs = `locationId=${LOCATION_ID}&formId=${formId}`;
    if (startAt) qs += `&startAt=${startAt}`;
    if (endAt) qs += `&endAt=${endAt}`;
    const data = await ghlRequest("GET", `/forms/submissions?${qs}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // SURVEYS
  server.tool("get_surveys", "Get all surveys in GHL", {}, async () => {
    const data = await ghlRequest("GET", `/surveys/?locationId=${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_survey_submissions", "Get submissions for a GHL survey", {
    surveyId: z.string()
  }, async ({ surveyId }) => {
    const data = await ghlRequest("GET", `/surveys/submissions?locationId=${LOCATION_ID}&surveyId=${surveyId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // USERS
  server.tool("get_users", "Get all users in GHL location", {}, async () => {
    const data = await ghlRequest("GET", `/users/?locationId=${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_user", "Get a single GHL user by ID", {
    userId: z.string()
  }, async ({ userId }) => {
    const data = await ghlRequest("GET", `/users/${userId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // LOCATION
  server.tool("get_location", "Get GHL location/sub-account details", {}, async () => {
    const data = await ghlRequest("GET", `/locations/${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_location_tags", "Get all tags in GHL location", {}, async () => {
    const data = await ghlRequest("GET", `/locations/${LOCATION_ID}/tags`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_custom_fields", "Get all custom fields in GHL location", {}, async () => {
    const data = await ghlRequest("GET", `/locations/${LOCATION_ID}/customFields`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_custom_values", "Get all custom values in GHL location", {}, async () => {
    const data = await ghlRequest("GET", `/locations/${LOCATION_ID}/customValues`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // FUNNELS AND WEBSITES
  server.tool("get_funnels", "Get all funnels in GHL", {}, async () => {
    const data = await ghlRequest("GET", `/funnels/funnel/list?locationId=${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  server.tool("get_websites", "Get all websites in GHL", {}, async () => {
    const data = await ghlRequest("GET", `/websites/?locationId=${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  // MEDIA
  server.tool("get_media_files", "Get media files in GHL", {}, async () => {
    const data = await ghlRequest("GET", `/medias/?locationId=${LOCATION_ID}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  });

  return server;
}

// SSE transport
const transports = {};

// Handle CORS for Claude
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.get("/sse", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => delete transports[transport.sessionId]);
  const server = createServer();
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) return res.status(404).json({ error: "Session not found" });
  await transport.handlePostMessage(req, res);
});

app.get("/health", (req, res) => res.json({ status: "ok", service: "ghl-mcp-server" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GHL MCP Server running on port ${PORT}`));
