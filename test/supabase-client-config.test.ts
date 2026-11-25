import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasSupabaseBrowserConfig } from '@/lib/supabase/client'

test('hasSupabaseBrowserConfig needs both the URL and the anon key', () => {
  assert.equal(hasSupabaseBrowserConfig('https://x.supabase.co', 'anon'), true)
  assert.equal(hasSupabaseBrowserConfig(undefined, 'anon'), false)
  assert.equal(hasSupabaseBrowserConfig('https://x.supabase.co', undefined), false)
  assert.equal(hasSupabaseBrowserConfig('', ''), false)
})
