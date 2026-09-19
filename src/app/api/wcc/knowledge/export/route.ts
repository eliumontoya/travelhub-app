import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("whatsapp_knowledge_entries")
    .select("id, topic, question, answer, tags, source, status, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = header.map((c) => ({ wch: c.w }));
  XLSX.utils.book_append_sheet(wb, ws, "Knowledge Base");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="knowledge-base-export.xlsx"`,
    },
  });
}
