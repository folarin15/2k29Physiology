import { isSupabaseConfigured, supabaseConfig } from "./supabase-config.js";

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

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

  return {
    ready: true,

    async signInRep(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
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
      const { data, error } = await supabase.rpc("register_member", {
        p_name: normalizeName(profile.name),
        p_matric_number: normalizeMatric(profile.matricNumber),
      });

      if (error) throw error;
      return { memberId: data };
    },

    async refreshMemberSession(session) {
      if (!session?.memberId || !session?.matricNumber) return;

      const { data, error } = await supabase.rpc("refresh_member_seen", {
        p_member_id: session.memberId,
        p_matric_number: normalizeMatric(session.matricNumber),
      });

      if (error) console.warn(error);
      return data !== false;
    },

    watchResources(callback, onError = console.error) {
      async function load() {
        const { data, error } = await supabase
          .from("resources")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          onError(error);
          return;
        }

        callback((data || []).map(mapResource));
      }

      return subscribeAndReload("portal-resources", "resources", load);
    },

    watchAnnouncements(callback, onError = console.error) {
      async function load() {
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

      const { data: publicFile } = supabase.storage.from(supabaseConfig.storageBucket).getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("resources").insert({
        title: String(formData.title || "").trim(),
        course_code: courseCode,
        course_title: String(formData.courseTitle || "").trim(),
        type: String(formData.type || "Resource"),
        note: String(formData.note || "").trim(),
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || "unknown",
        storage_path: filePath,
        download_url: publicFile.publicUrl,
        uploaded_by: role.displayName || user.email || "Course rep",
        uploaded_by_user_id: user.id,
      });

      if (insertError) {
        await supabase.storage.from(supabaseConfig.storageBucket).remove([filePath]).catch(() => undefined);
        throw insertError;
      }
    },

    async postAnnouncement(formData) {
      const user = await getCurrentUser();
      if (!user) throw new Error("Please sign in as a course rep first.");

      const role = await getRole(user.id);
      if (!role || !["rep", "admin"].includes(role.role)) {
        throw new Error("This account is not allowed to post announcements.");
      }

      const { error } = await supabase.from("announcements").insert({
        title: String(formData.title || "").trim(),
        message: String(formData.message || "").trim(),
        priority: String(formData.priority || "Normal"),
        posted_by: role.displayName || user.email || "Course rep",
        posted_by_user_id: user.id,
      });

      if (error) throw error;
    },

    async submitSuggestion(formData) {
      const { error } = await supabase.from("suggestions").insert({
        name: normalizeName(formData.name),
        matric_number: normalizeMatric(formData.matricNumber),
        category: String(formData.category || "General").trim(),
        message: normalizeSuggestionMessage(formData.message),
      });

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
