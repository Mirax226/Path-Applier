// supabaseConnectionsStore.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedConnections = null;
let loaded = false;

/**
 * نوع کانکشن:
 * {
 *   id: string;
 *   name: string;
 *   envKey: string;
 * }
 */

export async function loadSupabaseConnections() {
  if (loaded && Array.isArray(cachedConnections)) {
    return cachedConnections;
  }

  const filePath = path.join(__dirname, "..", "supabaseConnections.json");

  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("supabaseConnections.json must contain a JSON array");
    }

    cachedConnections = parsed;
    loaded = true;
  } catch (err) {
    console.error("Failed to load supabaseConnections.json:", err);
    cachedConnections = [];
    loaded = true;
  }

  return cachedConnections;
}

export function findSupabaseConnection(id) {
  if (!Array.isArray(cachedConnections)) return undefined;
  return cachedConnections.find((c) => c.id === id);
}

// برای سازگاری با کد موجود، این تابع فقط کش را آپدیت می‌کند
// و فعلاً چیزی در DB ذخیره نمی‌کند.
export async function saveSupabaseConnections(connections) {
  if (Array.isArray(connections)) {
    cachedConnections = connections;
    loaded = true;
  }
  // اگر بعداً خواستی به DB هم ذخیره کنی، اینجا می‌شود اضافه کرد.
}
