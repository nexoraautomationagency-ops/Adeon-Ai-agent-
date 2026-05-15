const { dbExec } = require('../server/db/connection');

async function fixRPC() {
  console.log('🛠️ Fixing Supabase RPC Functions...');

  const sql = `
    -- Drop old versions first
    DROP FUNCTION IF EXISTS match_knowledge_v2(vector, float, int, text, int);
    DROP FUNCTION IF EXISTS match_intents(vector, float, int, int);

    -- Recreate match_knowledge_v2
    CREATE OR REPLACE FUNCTION match_knowledge_v2 (
      query_embedding vector(1536),
      match_threshold float,
      match_count int,
      filter_category text DEFAULT NULL,
      filter_tutor_id int DEFAULT NULL
    )
    RETURNS TABLE (
      id int,
      content text,
      category text,
      metadata jsonb,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        kb.id,
        kb.content,
        kb.category,
        kb.metadata,
        (1 - (kb.embedding <=> query_embedding))::float AS similarity
      FROM knowledge_base kb
      WHERE (1 - (kb.embedding <=> query_embedding) > match_threshold)
      AND (filter_category IS NULL OR kb.category = filter_category)
      AND (filter_tutor_id IS NULL OR kb.tutor_id IS NULL OR kb.tutor_id = filter_tutor_id)
      ORDER BY kb.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;

    -- Recreate match_intents
    CREATE OR REPLACE FUNCTION match_intents (
      query_embedding vector(1536),
      match_threshold float,
      match_count int,
      filter_tutor_id int DEFAULT NULL
    )
    RETURNS TABLE (
      intent text,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        (kb.metadata->>'intent')::text as intent,
        (1 - (kb.embedding <=> query_embedding))::float AS similarity
      FROM knowledge_base kb
      WHERE kb.category = 'INTENT'
      AND (1 - (kb.embedding <=> query_embedding) > match_threshold)
      AND (filter_tutor_id IS NULL OR kb.tutor_id IS NULL OR kb.tutor_id = filter_tutor_id)
      ORDER BY kb.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
  `;

  try {
    await dbExec(sql);
    console.log('✅ RPC Functions Recreated Successfully.');
  } catch (err) {
    console.error('❌ RPC Fix Failed:', err.message);
  } finally {
    process.exit();
  }
}

fixRPC();
