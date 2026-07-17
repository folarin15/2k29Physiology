// ============================================================
// PhysioK29 — Executive Portal Bootstrap
// Standalone bridge provider (replaces app.v20260717-1.js)
// ============================================================

import { getSupabaseClient } from "./utils/supabase-client.js";

const BACKEND_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ── State ──────────────────────────────────────────────── */
const state = {
  backend: null,
  supabase: null,
  members: [],
  resources: [],
  announcements: [],
  suggestions: [],
  resourceProgress: [],
  resourceFeedback: [],
  studyEvents: [],
  quizAttempts: [],
  topicPerformance: [],
  authUser: null,
  authRole: null,
};

/* ── Helpers (minimal subset shared with exec module) ───── */
function toMillis(v) { return v ? new Date(v).getTime() || 0 : 0; }

function mapMember(row) {
  return {
    id: row.id,
    name: row.name || "",
    matricNumber: row.matric_number || "",
    notificationEnabled: Boolean(row.notification_enabled),
    lastSeenAtMs: toMillis(row.last_seen_at),
    createdAtMs: toMillis(row.created_at),
    photoUrl: row.birthday_photo_url || "",
    fullName: row.full_name || "",
    dateOfBirth: row.date_of_birth || "",
    birthdayRegistrationCompleted: Boolean(row.birthday_registration_completed),
  };
}

function mapResource(row) {
  return {
    id: row.id,
    title: row.title || "",
    courseCode: row.course_code || "",
    type: row.type || "Resource",
    fileName: row.file_name || "",
    downloadUrl: row.download_url || "",
    uploadedBy: row.uploaded_by || "",
    uploadedByUid: row.uploaded_by_uid || "",
    note: row.note || "",
    createdAtMs: toMillis(row.created_at),
  };
}

function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title || "",
    message: row.message || "",
    priority: row.priority || "Normal",
    postedBy: row.posted_by || "",
    postedByUid: row.posted_by_uid || "",
    createdAtMs: toMillis(row.created_at),
  };
}

function mapSuggestion(row) {
  return {
    id: row.id,
    name: row.name || "",
    matricNumber: row.matric_number || "",
    category: row.category || "General",
    message: row.message || "",
    status: row.status || "pending",
    isAnonymous: Boolean(row.is_anonymous),
    createdAtMs: toMillis(row.created_at),
  };
}

/* ── Backend ────────────────────────────────────────────── */
class ExecutiveBackend {
  constructor(supabase) {
    this._supabase = supabase;
    this._authListeners = [];
    this._authUnsub = null;
  }

  /* Auth */
  async signInRep(email, password) {
    const { data, error } = await this._supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this._resolveRole(data.user);
    return data.user;
  }

  async signOutRep() {
    await this._supabase.auth.signOut();
    this._notifyAuth(null, null);
  }

  onAuth(fn) {
    this._authListeners.push(fn);
    if (!this._authUnsub) {
      this._authUnsub = this._supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          this._resolveRole(session?.user);
        } else if (event === "SIGNED_OUT") {
          this._notifyAuth(null, null);
        }
      }).data?.unsubscribe || (() => {});
    }
    const user = this._supabase.auth.currentUser;
    if (user) {
      this._resolveRole(user).then(() => {});
    }
    return () => { this._authListeners = this._authListeners.filter((l) => l !== fn); };
  }

  async _resolveRole(user) {
    if (!user) { this._notifyAuth(null, null); return; }
    try {
      const { data } = await this._supabase
        .from("staff_roles")
        .select("role, display_name")
        .eq("uid", user.id)
        .single();
      const role = data ? { role: data.role, displayName: data.display_name } : null;
      this._notifyAuth(user, role);
    } catch { this._notifyAuth(user, null); }
  }

  _notifyAuth(user, role) {
    state.authUser = user;
    state.authRole = role;
    this._authListeners.forEach((fn) => { try { fn(user, role); } catch {} });
  }

  /* Data loading */
  async loadAll() {
    const [members, resources, announcements, suggestions, progress, feedback, events, attempts, topics] =
      await Promise.all([
        this._supabase.from("members").select("*").order("created_at", { ascending: false }),
        this._supabase.from("resources").select("*").order("created_at", { ascending: false }),
        this._supabase.from("announcements").select("*").order("created_at", { ascending: false }),
        this._supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
        this._supabase.from("resource_progress").select("*"),
        this._supabase.from("resource_feedback").select("*"),
        this._supabase.from("study_events").select("*"),
        this._supabase.from("quiz_attempts").select("*").order("submitted_at", { ascending: false }),
        this._supabase.from("topic_performance").select("*"),
      ]);
    state.members = (members.data || []).map(mapMember);
    state.resources = (resources.data || []).map(mapResource);
    state.announcements = (announcements.data || []).map(mapAnnouncement);
    state.suggestions = (suggestions.data || []).map(mapSuggestion);
    state.resourceProgress = progress.data || [];
    state.resourceFeedback = feedback.data || [];
    state.studyEvents = events.data || [];
    state.quizAttempts = attempts.data || [];
    state.topicPerformance = topics.data || [];
  }

  /* Mutations */
  async deleteMember(id) {
    const { error } = await this._supabase.from("members").delete().eq("id", id);
    if (error) throw error;
    state.members = state.members.filter((m) => m.id !== id);
  }

  async deleteResource(resource) {
    const { error } = await this._supabase.from("resources").delete().eq("id", resource.id);
    if (error) throw error;
    if (resource.fileName) {
      try { await this._supabase.storage.from("class-resources").remove([resource.fileName]); } catch {}
    }
    state.resources = state.resources.filter((r) => r.id !== resource.id);
  }

  async deleteAnnouncement(id) {
    const { error } = await this._supabase.from("announcements").delete().eq("id", id);
    if (error) throw error;
    state.announcements = state.announcements.filter((a) => a.id !== id);
  }

  async deleteSuggestion(id) {
    const { error } = await this._supabase.from("suggestions").delete().eq("id", id);
    if (error) throw error;
    state.suggestions = state.suggestions.filter((s) => s.id !== id);
  }

  async updateResource(id, data) {
    const { error } = await this._supabase.from("resources").update(data).eq("id", id);
    if (error) throw error;
  }

  async updateAnnouncement(id, data) {
    const { error } = await this._supabase.from("announcements").update(data).eq("id", id);
    if (error) throw error;
  }

  async uploadResource(data, file, onProgress) {
    const ext = file.name.split(".").pop() || "pdf";
    const fileName = `${data.courseCode}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadError } = await this._supabase.storage
      .from("class-resources")
      .upload(fileName, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data: urlData } = await this._supabase.storage
      .from("class-resources")
      .getPublicUrl(fileName);
    const downloadUrl = urlData?.publicUrl || "";
    const { error: dbError } = await this._supabase.from("resources").insert({
      title: data.title,
      course_code: data.courseCode,
      type: data.type || "Resource",
      file_name: fileName,
      download_url: downloadUrl,
      note: data.note || "",
      uploaded_by: state.authUser?.email || "Executive",
      uploaded_by_uid: state.authUser?.id || null,
      created_at: new Date().toISOString(),
    });
    if (dbError) throw dbError;
  }

  async postAnnouncement(data) {
    const { error } = await this._supabase.from("announcements").insert({
      title: data.title,
      message: data.message,
      priority: data.priority || "Normal",
      posted_by: state.authUser?.email || "Executive",
      posted_by_uid: state.authUser?.id || null,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  async getBirthdayList() {
    const { data, error } = await this._supabase
      .from("members")
      .select("id, name, matric_number, full_name, date_of_birth, birthday_photo_url")
      .not("date_of_birth", "is", null);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      name: r.name || "",
      matricNumber: r.matric_number || "",
      fullName: r.full_name || "",
      dateOfBirth: r.date_of_birth || "",
      photoUrl: r.birthday_photo_url || "",
    }));
  }

  async saveBirthdayProfile(fullName, dateOfBirth, photoUrl) {
    const user = this._supabase.auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const { error } = await this._supabase
      .from("members")
      .update({
        full_name: fullName,
        date_of_birth: dateOfBirth,
        birthday_photo_url: photoUrl,
        birthday_registration_completed: true,
      })
      .eq("uid", user.id);
    if (error) throw error;
  }

  async uploadBirthdayPhoto(file, memberId) {
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `birthday-photos/${memberId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await this._supabase.storage
      .from("birthday-photos")
      .upload(filePath, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;
    const { data: urlData } = await this._supabase.storage
      .from("birthday-photos")
      .getPublicUrl(filePath);
    return urlData?.publicUrl || `${this._supabase.supabaseUrl}/storage/v1/object/public/birthday-photos/${filePath}`;
  }

  generateResourceDetails(opts) {
    return Promise.resolve({ title: opts.fileName.replace(/\.[^.]+$/, ""), context: "" });
  }
}

/* ── Init ───────────────────────────────────────────────── */
export async function initExecutivePortal() {
  const supabase = await getSupabaseClient();
  state.supabase = supabase;
  state.backend = new ExecutiveBackend(supabase);

  window.__PHYSIOK29_STATE__ = state;
  window.__PHYSIOK29_BACKEND__ = state.backend;

  /* Load the executive module (assumes it's on the same origin) */
  const script = document.createElement("script");
  script.type = "module";
  script.src = "./executive.v20260717-1.js";
  document.body.appendChild(script);

  /* Preload data after auth resolves */
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      state.backend.loadAll().catch(console.warn);
    }
  });
  if (supabase.auth.currentUser) {
    state.backend.loadAll().catch(console.warn);
  }
}

/* Auto-start if this is a staff page */
if (document.body.dataset.portal === "staff") {
  initExecutivePortal().catch(console.error);
}
