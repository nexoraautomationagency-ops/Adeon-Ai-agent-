const { dbExec } = require('../server/db/connection');

async function fixRPC() {
  console.log('🛠️ Fixing Supabase RPC Functions (Version 4 - The Survivor)...');

  const sql = `
    DROP FUNCTION IF EXISTS match_knowledge_v2(vector, float, int, text, int);
    
    CREATE OR REPLACE FUNCTION match_knowledge_v2 (
      query_embedding vector(1536),
      match_threshold float,
      match_count int,
      filter_category text DEFAULT NULL,
      filter_tutor_id int DEFAULT NULL
    )
    RETURNS TABLE (
      id bigint,
      content text,
      category text,
      metadata jsonb,
      similarity double precision
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        kb.id::bigint,
        kb.content::text,
        kb.category::text,
        kb.metadata::jsonb,
        (1 - (kb.embedding <=> query_embedding))::double precision AS similarity
      FROM knowledge_base kb
      WHERE (1 - (kb.embedding <=> query_embedding) > match_threshold)
      AND (filter_category IS NULL OR kb.category = filter_category)
      AND (filter_tutor_id IS NULL OR kb.tutor_id IS NULL OR kb.tutor_id = filter_tutor_id)
      ORDER BY kb.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
  `;

  try {
    await dbExec(sql);
    console.log('✅ RPC Fixed with explicit bigint/text/jsonb/double precision.');
  } catch (err) {
    console.error('❌ RPC Fix Failed:', err.message);
  } finally {
    process.exit();
  }
}

fixRPC();
