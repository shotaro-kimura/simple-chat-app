// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

//削除関数
export const deleteMessage = async (id) => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);
  
    if (error) {
      console.error('削除に失敗:', error.message);
    }
  };