import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve, relative, sep } from "node:path";
import { randomUUID } from "node:crypto";

export async function storeCarPhoto(bytes: Buffer, extension: string) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_CAR_PHOTO_BUCKET;
  const fileName = `${randomUUID()}.${extension}`;
  if (supabaseUrl && serviceKey && bucket) {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${fileName}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": `image/${extension === "jpg" ? "jpeg" : extension}`, "x-upsert": "false" },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("The vehicle photo could not be saved to image storage.");
    return { url: `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${fileName}`, cleanup: async () => removeCarPhoto(`${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${fileName}`) };
  }
  if (process.env.NODE_ENV === "production") throw new Error("Persistent car-photo storage is not configured.");
  const directory = join(process.cwd(), "public", "uploads", "car-hire");
  const absolutePath = join(directory, fileName);
  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, bytes, { flag: "wx" });
  return { url: `/uploads/car-hire/${fileName}`, cleanup: async () => rm(absolutePath, { force: true }) };
}

export async function removeCarPhoto(url: string | null | undefined) {
  if (!url) return;
  if (url.startsWith("/uploads/car-hire/")) {
    const fileName = url.slice("/uploads/car-hire/".length);
    if (!/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(fileName)) return;
    const directory = resolve(process.cwd(), "public", "uploads", "car-hire");
    const absolutePath = resolve(directory, fileName);
    const pathFromDirectory = relative(directory, absolutePath);
    if (pathFromDirectory && !pathFromDirectory.startsWith(`..${sep}`) && pathFromDirectory !== "..") await rm(absolutePath, { force: true });
    return;
  }
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_CAR_PHOTO_BUCKET;
  if (!supabaseUrl || !serviceKey || !bucket || !url.startsWith(`${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/`)) return;
  const objectPath = url.slice(`${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/`.length);
  await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`, { method: "DELETE", headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }, signal: AbortSignal.timeout(10000) });
}
