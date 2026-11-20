import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "Method not allowed" });

  const authorization = request.headers.get("Authorization");
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !projectUrl || !publishableKey || !serviceRoleKey) {
    return respond(401, { error: "A valid signed-in session is required" });
  }

  const userClient = createClient(projectUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return respond(401, { error: "Your session is invalid or expired" });

  let body: { business_id?: string; email?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: "Request body must be valid JSON" });
  }

  const businessId = body.business_id?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role?.trim();
  if (!businessId || !email || !role) return respond(400, { error: "Business, email and role are required" });
  const appUrl = Deno.env.get("APP_URL") || request.headers.get("origin");
  if (!appUrl) return respond(500, { error: "Set APP_URL or call the function from the business app" });

  const { data: invitationId, error: invitationError } = await userClient.rpc("create_business_invitation", {
    p_business_id: businessId,
    p_email: email,
    p_role: role,
  });
  if (invitationError || !invitationId) {
    return respond(403, { error: invitationError?.message || "Could not create the invitation" });
  }

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const redirectTo = new URL("/", appUrl);
  redirectTo.searchParams.set("invitation_id", invitationId);
  const { error: emailError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTo.toString(),
  });

  if (emailError) {
    await adminClient.from("business_invitations").update({ status: "revoked" }).eq("id", invitationId);
    return respond(502, { error: `Invitation email could not be sent: ${emailError.message}` });
  }

  return respond(200, { invitation_id: invitationId, email, role });
});
