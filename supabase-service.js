import { isSupabaseConfigured, supabaseConfig } from "./supabase-config.js?v=20260526b";

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const RESOURCE_PAGE_SIZE = 1000;
const MEMBER_SESSION_KEY = "physiology2k29.memberSession";
const MEMBER_PORTAL_FUNCTION = "member-portal";

let clientPromise;

/* SDK LOADER: Loads Supabase only when project credentials are present. */
async function loadSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  if (!clientPromise) {
    clientPromise = import(SUPABASE_CDN).then(({ createClient }) =>
      createClient(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    );
  }

  return clientPromise;
}

function sortByCreatedAt(items) {
  return [...items].sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

function toMillis(value) {
  if (!value) return 0;
  return new Date(value).getTime() || 0;
}

function normalizeName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 3) throw new Error("Enter your full name.");
  if (name.length > 80) throw new Error("Name is too long.");
  return name;
}

function normalizeMatric(value) {
  const matricNumber = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (matricNumber.length < 3) throw new Error("Enter a valid matric number.");
  if (matricNumber.length > 24) throw new Error("Matric number is too long.");
  return matricNumber;
}

function normalizeSuggestionMessage(value) {
  const message = String(value || "").trim();
  if (message.length < 3) throw new Error("Write a little more before sending.");
  if (message.length > 1200) throw new Error("Suggestion is too long.");
  return message;
}

function isStaffPortal() {
  return globalThis.document?.body?.dataset.portal === "staff";
}

function getStoredMemberSession() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(MEMBER_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

/* TEXT HYGIENE: Keeps stored display text clean even when filenames contain emoji. */
function stripSiteEmoji(value = "") {
  return String(value)
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanStoredText(value = "") {
  return stripSiteEmoji(value);
}

function safeFileName(fileName) {
  return String(fileName || "resource")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function mapResource(row) {
  return {
    id: row.id,
    title: row.title,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    type: row.type,
    note: row.note,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    storagePath: row.storage_path,
    downloadUrl: row.download_url,
    uploadedBy: row.uploaded_by,
    uploadedByUid: row.uploaded_by_user_id,
    createdAtMs: toMillis(row.created_at),
  };
}

function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    priority: row.priority,
    postedBy: row.posted_by,
    postedByUid: row.posted_by_user_id,
    createdAtMs: toMillis(row.created_at),
  };
}

function mapMember(row) {
  return {
    id: row.id,
    name: row.name,
    matricNumber: row.matric_number,
    createdAtMs: toMillis(row.created_at),
    lastSeenAtMs: toMillis(row.last_seen_at),
  };
}

function mapSuggestion(row) {
  return {
    id: row.id,
    name: row.name,
    matricNumber: row.matric_number,
    category: row.category,
    message: row.message,
    createdAtMs: toMillis(row.created_at),
  };
}

function offlineNotice(methodName) {
  console.warn(`${methodName} skipped because Supabase is not configured yet.`);
}

/* BACKEND FACTORY: Exposes one app-shaped API over Supabase Auth, Storage, and tables. */
export async function createBackend() {
  const supabase = await loadSupabaseClient();

  if (!supabase) {
    return {
      ready: false,
      signInRep: async () => {
        throw new Error("Add your Supabase URL and anon key before signing in.");
      },
      signOutRep: async () => undefined,
      onAuth: (callback) => {
        callback(null, null);
        return () => undefined;
      },
      registerMember: async (profile) => ({
        memberId: `local-${normalizeMatric(profile.matricNumber)}`,
      }),
      refreshMemberSession: async () => undefined,
      watchResources: (callback) => {
        offlineNotice("watchResources");
        callback([]);
        return () => undefined;
      },
      watchAnnouncements: (callback) => {
        offlineNotice("watchAnnouncements");
        callback([]);
        return () => undefined;
      },
      watchMembers: (callback) => {
        offlineNotice("watchMembers");
        callback([]);
        return () => undefined;
      },
      watchSuggestions: (callback) => {
        offlineNotice("watchSuggestions");
        callback([]);
        return () => undefined;
      },
      uploadResource: async () => {
        throw new Error("Add your Supabase config before uploading files.");
      },
      postAnnouncement: async () => {
        throw new Error("Add your Supabase config before posting announcements.");
      },
      updateResource: async () => {
        throw new Error("Add your Supabase config before editing resources.");
      },
      updateAnnouncement: async () => {
        throw new Error("Add your Supabase config before editing announcements.");
      },
      generateResourceDetails: async () => {
        throw new Error("Add your Supabase config before generating upload details.");
      },
      deleteResource: async () => {
        throw new Error("Add your Supabase config before deleting resources.");
      },
      deleteAnnouncement: async () => {
        throw new Error("Add your Supabase config before deleting announcements.");
      },
      submitSuggestion: async () => {
        throw new Error("Add your Supabase config before sending suggestions.");
      },
      deleteSuggestion: async () => {
        throw new Error("Add your Supabase config before deleting suggestions.");
      },
      deleteMember: async () => {
        throw new Error("Add your Supabase config before deleting members.");
      },
    };
  }

  async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  }

  async function getRole(uid) {
    if (!uid) return null;

    const { data, error } = await supabase
      .from("staff_roles")
      .select("role, display_name")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) throw error;
    return data ? { role: data.role, displayName: data.display_name } : null;
  }

  async function notifyPortal(payload) {
    const { error } = await supabase.functions.invoke("send-portal-notification", {
      body: {
        url: "https://2k29physiology.pxxl.click/dashboard.html",
        ...payload,
      },
    });

    if (error) throw error;
  }

  async function callMemberPortal(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke(MEMBER_PORTAL_FUNCTION, {
      body: {
        action,
        ...payload,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data || {};
  }

  let memberPortalDataPromise = null;
  let memberPortalDataCachedAt = 0;

  async function loadMemberPortalData() {
    const now = Date.now();
    if (memberPortalDataPromise && now - memberPortalDataCachedAt < 3000) {
      return memberPortalDataPromise;
    }

    memberPortalDataCachedAt = now;
    memberPortalDataPromise = callMemberPortal("portal-data", {
      memberSession: getStoredMemberSession(),
    }).finally(() => {
      window.setTimeout(() => {
        memberPortalDataPromise = null;
      }, 3000);
    });

    return memberPortalDataPromise;
  }

  function subscribeAndReload(channelName, tableName, load) {
    load();

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: tableName }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function loadAllResources() {
    const rows = [];
    let from = 0;

    while (true) {
      const to = from + RESOURCE_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      rows.push(...(data || []));

      if (!data || data.length < RESOURCE_PAGE_SIZE) return rows;
      from += RESOURCE_PAGE_SIZE;
    }
  }

  async function signResourceRows(rows) {
    return Promise.all(
      rows.map(async (row) => {
        if (!row.storage_path) return row;
        const { data, error } = await supabase.storage
          .from(supabaseConfig.storageBucket)
          .createSignedUrl(row.storage_path, 60 * 60);

        return {
          ...row,
          download_url: error ? "" : data?.signedUrl || "",
        };
      })
    );
  }

  function pollAndReload(load, intervalMs = 60000) {
    load();
    const intervalId = window.setInterval(load, intervalMs);
    return () => window.clearInterval(intervalId);
  }

  return {
    ready: true,

    async signInRep(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(email || "").trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      return data;
    },

    async signOutRep() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },

    onAuth(callback) {
      let disposed = false;

      async function emit(user) {
        try {
          const role = user ? await getRole(user.id) : null;
          if (!disposed) callback(user, role);
        } catch (error) {
          if (!disposed) callback(user, null);
          console.error(error);
        }
      }

      supabase.auth.getSession().then(({ data }) => emit(data.session?.user || null));

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        emit(session?.user || null);
      });

      return () => {
        disposed = true;
        data.subscription.unsubscribe();
      };
    },

    async registerMember(profile) {
      const data = await callMemberPortal("register", {
        name: normalizeName(profile.name),
        matricNumber: normalizeMatric(profile.matricNumber),
      });

      return {
        memberId: data.memberId,
        name: data.name || normalizeName(profile.name),
        matricNumber: data.matricNumber || normalizeMatric(profile.matricNumber),
      };
    },

    async refreshMemberSession(session) {
      if (!session?.memberId || !session?.matricNumber) return;

      try {
        const data = await callMemberPortal("refresh", {
          memberSession: {
            memberId: session.memberId,
            name: normalizeName(session.name),
            matricNumber: normalizeMatric(session.matricNumber),
          },
        });
        return data.ok !== false;
      } catch (error) {
        console.warn(error);
        return false;
      }
    },

    watchResources(callback, onError = console.error) {
      async function load() {
        try {
          if (isStaffPortal()) {
            const data = await loadAllResources();
            callback((await signResourceRows(data)).map(mapResource));
            return;
          }

          const data = await loadMemberPortalData();
          callback((data.resources || []).map(mapResource));
        } catch (error) {
          onError(error);
        }
      }

      if (!isStaffPortal()) return pollAndReload(load);
      return subscribeAndReload("portal-resources", "resources", load);
    },

    watchAnnouncements(callback, onError = console.error) {
      async function load() {
        if (!isStaffPortal()) {
          try {
            const data = await loadMemberPortalData();
            callback((data.announcements || []).map(mapAnnouncement));
          } catch (error) {
            onError(error);
          }
          return;
        }

        const { data, error } = await supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(40);

        if (error) {
          onError(error);
          return;
        }

        callback((data || []).map(mapAnnouncement));
      }

      if (!isStaffPortal()) return pollAndReload(load);
      return subscribeAndReload("portal-announcements", "announcements", load);
    },

    watchMembers(callback, onError = console.error) {
      async function load() {
        const { data, error } = await supabase
          .from("members")
          .select("id, name, matric_number, created_at, last_seen_at")
          .order("created_at", { ascending: false })
          .limit(300);

        if (error) {
          onError(error);
          return;
        }

        callback((data || []).map(mapMember));
      }

      return subscribeAndReload("portal-members", "members", load);
    },

    watchSuggestions(callback, onError = console.error) {
      async function load() {
        const { data, error } = await supabase
          .from("suggestions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          onError(error);
          return;
        }

        callback((data || []).map(mapSuggestion));
      }

      return subscribeAndReload("portal-suggestions", "suggestions", load);
    },

    async uploadResource(formData, file, onProgress) {
      const user = await getCurrentUser();
      if (!user) throw new Error("Please sign in as a course rep first.");
      if (!(file instanceof File) || !file.name) throw new Error("Choose a file to upload.");
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("Keep files under 50 MB on the free storage plan.");

      const role = await getRole(user.id);
      if (!role || !["rep", "admin"].includes(role.role)) {
        throw new Error("This account is not allowed to upload resources.");
      }

      const courseCode = String(formData.courseCode || "").trim();
      const filePath = `${courseCode}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(supabaseConfig.storageBucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      if (onProgress) onProgress(100);

      const resourceTitle = cleanStoredText(formData.title || "");
      const resourceType = cleanStoredText(formData.type || "Resource");
      const { error: insertError } = await supabase.from("resources").insert({
        title: resourceTitle,
        course_code: courseCode,
        course_title: cleanStoredText(formData.courseTitle || ""),
        type: resourceType,
        note: cleanStoredText(formData.note || ""),
        file_name: cleanStoredText(file.name) || safeFileName(file.name),
        file_size: file.size,
        file_type: file.type || "unknown",
        storage_path: filePath,
        download_url: filePath,
        uploaded_by: role.displayName || user.email || "Course rep",
        uploaded_by_user_id: user.id,
      });

      if (insertError) {
        await supabase.storage.from(supabaseConfig.storageBucket).remove([filePath]).catch(() => undefined);
        throw insertError;
      }

      notifyPortal({
        type: "resource",
        title: resourceTitle,
        courseCode,
        resourceType,
      }).catch((error) => console.warn("Push notification skipped:", error));
    },

    async postAnnouncement(formData) {
      const user = await getCurrentUser();
      if (!user) throw new Error("Please sign in as a course rep first.");

      const role = await getRole(user.id);
      if (!role || !["rep", "admin"].includes(role.role)) {
        throw new Error("This account is not allowed to post announcements.");
      }

      const announcementTitle = cleanStoredText(formData.title || "");
      const announcementMessage = cleanStoredText(formData.message || "");
      const { error } = await supabase.from("announcements").insert({
        title: announcementTitle,
        message: announcementMessage,
        priority: cleanStoredText(formData.priority || "Normal"),
        posted_by: role.displayName || user.email || "Course rep",
        posted_by_user_id: user.id,
      });

      if (error) throw error;

      notifyPortal({
        type: "announcement",
        title: announcementTitle,
        message: announcementMessage,
      }).catch((error) => console.warn("Push notification skipped:", error));
    },

    async submitSuggestion(formData) {
      await callMemberPortal("submit-suggestion", {
        memberSession: getStoredMemberSession(),
        category: String(formData.category || "General").trim(),
        message: normalizeSuggestionMessage(formData.message),
      });
    },

    async generateResourceDetails(input) {
      const { data, error } = await supabase.functions.invoke("generate-resource-details", {
        body: {
          courseCode: cleanStoredText(input.courseCode || ""),
          courseTitle: cleanStoredText(input.courseTitle || ""),
          fileName: cleanStoredText(input.fileName || ""),
          existingTitle: cleanStoredText(input.existingTitle || ""),
          existingNote: cleanStoredText(input.existingNote || ""),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },

    async updateResource(resourceId, updates) {
      const payload = {
        title: cleanStoredText(updates.title),
        type: cleanStoredText(updates.type || "Resource"),
        note: cleanStoredText(updates.note || ""),
        file_name: cleanStoredText(updates.fileName || "resource"),
      };

      if (!payload.title) throw new Error("Resource title is required.");
      if (!payload.file_name) throw new Error("Display file name is required.");

      const { error } = await supabase.from("resources").update(payload).eq("id", resourceId);
      if (error) throw error;
    },

    async updateAnnouncement(announcementId, updates) {
      const payload = {
        title: cleanStoredText(updates.title),
        message: cleanStoredText(updates.message),
        priority: cleanStoredText(updates.priority || "Normal"),
      };

      if (!payload.title) throw new Error("Announcement title is required.");
      if (!payload.message) throw new Error("Announcement message is required.");

      const { error } = await supabase.from("announcements").update(payload).eq("id", announcementId);
      if (error) throw error;
    },

    async deleteResource(resource) {
      if (resource.storagePath) {
        await supabase.storage.from(supabaseConfig.storageBucket).remove([resource.storagePath]).catch(console.warn);
      }

      const { error } = await supabase.from("resources").delete().eq("id", resource.id);
      if (error) throw error;
    },

    async deleteAnnouncement(announcementId) {
      const { error } = await supabase.from("announcements").delete().eq("id", announcementId);
      if (error) throw error;
    },

    async deleteSuggestion(suggestionId) {
      const { error } = await supabase.from("suggestions").delete().eq("id", suggestionId);
      if (error) throw error;
    },

    async deleteMember(memberId) {
      const { error } = await supabase.from("members").delete().eq("id", memberId);
      if (error) throw error;
    },
  };
}

export { sortByCreatedAt };
