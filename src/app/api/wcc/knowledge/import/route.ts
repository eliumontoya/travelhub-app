import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

type KnowledgeRow = {
  id?: string;
  topic: string;
  question: string;
  answer: string;
  tags: string[];
  source: string | null;
  status: "draft" | "approved" | "archived";
};

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(",") : typeof value === "string" ? value : "";
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}

function normalizeStatus(value: unknown): "draft" | "approved" | "archived" {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "approved" || v === "archived" || v === "draft") return v;
  return "draft";
}

function parseRow(row: Record<string, unknown>): KnowledgeRow | null {
  const topic = typeof row.topic === "string" ? row.topic.trim() : "";
  const question = typeof row.question === "string" ? row.question.trim() : "";
  const answer = typeof row.answer === "string" ? row.answer.trim() : "";

  if (!topic || !question || !answer) return null;

  const source = typeof row.source === "string" ? row.source.trim() : "";
  const id = typeof row.id === "string" ? row.id.trim() : undefined;

  return {
    id: id || undefined,
    topic: topic.slice(0, 120),
    question: question.slice(0, 500),
    answer: answer.slice(0, 4000),
    tags: normalizeTags(row.tags).slice(0, 12).map((t) => t.slice(0, 40)),
    source: source ? source.slice(0, 300) : null,
    status: normalizeStatus(row.status),
  };
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
  }

  const arrayBuf = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

  const rows = json.map(parseRow).filter((r): r is KnowledgeRow => r !== null);

  if (rows.length === 0) {
    return NextResponse.json({ error: "El archivo no contiene filas válidas. Cada fila necesita topic, question y answer." }, { status: 400 });
  }

  const created: string[] = [];
  const updated: string[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const payload = {
      topic: row.topic,
      question: row.question,
      answer: row.answer,
      tags: row.tags,
      source: row.source,
      status: row.status,
      approved_at: row.status === "approved" ? new Date().toISOString() : null,
    };

    if (row.id) {
      const { error } = await supabase.from("whatsapp_knowledge_entries").update(payload).eq("id", row.id);
      if (error) {
        errors.push({ row: i + 2, error: error.message });
      } else {
        updated.push(row.id);
      }
    } else {
      const { data, error } = await supabase.from("whatsapp_knowledge_entries").insert(payload).select("id").single();
      if (error) {
        errors.push({ row: i + 2, error: error.message });
      } else if (data?.id) {
        created.push(data.id);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
    updated: updated.length,
    errors: errors.length,
    errorDetails: errors.slice(0, 10),
  });
}
