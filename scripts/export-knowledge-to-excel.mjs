import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data, error } = await supabase
    .from("whatsapp_knowledge_entries")
    .select("id, topic, question, answer, tags, source, status, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error consultando knowledge entries:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    topic: row.topic,
    question: row.question,
    answer: row.answer,
    tags: Array.isArray(row.tags) ? row.tags.join(", ") : "",
    source: row.source ?? "",
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const wb = XLSX.utils.book_new();

  const header = [
    { h: "id", w: 38 },
    { h: "topic", w: 30 },
    { h: "question", w: 50 },
    { h: "answer", w: 60 },
    { h: "tags", w: 30 },
    { h: "source", w: 30 },
    { h: "status", w: 12 },
  ];

  const aoa = [
    header.map((c) => c.h),
    ...rows.map((r) => [r.id, r.topic, r.question, r.answer, r.tags, r.source, r.status]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = header.map((c) => ({ wch: c.w }));

  XLSX.utils.book_append_sheet(wb, ws, "Knowledge Base");

  const outPath = resolve(__dirname, "..", "knowledge-base-export.xlsx");
  XLSX.writeFile(wb, outPath);

  console.log(`Exportados ${rows.length} registros a: ${outPath}`);
}

main();
