import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const getCurrentTime = () => {
  const d = new Date();
  return d.toLocaleTimeString();
};

const excludedKeywords = [ /* ...省略（同じリスト） */ ];

const isExcluded = (text, input) => {
  const normalize = str => str.replace(/\s/g, '');
  const cleanedText = normalize(text);
  const cleanedInput = normalize(input);
  return excludedKeywords.includes(cleanedText) || excludedKeywords.includes(cleanedInput);
};

const deleteMessage = async (id) => {
  const { error } = await supabase.from('messages').delete().eq('id', id);
  if (error) console.error('削除エラー:', error.message);
};

const SimpleChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    const subscription = supabase
      .channel('chat-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (!error) setMessages(data);
  };

  const sendMessage = async (color) => {
    const trimmed = input.trim();
    if (!trimmed || !username.trim()) return;

    const isOnlyExcluded = excludedKeywords.some(term => trimmed === term);
    if (isOnlyExcluded) {
      alert('除外ワードのみのメッセージは送信できません');
      return;
    }

    const newMessage = {
      user: username,
      text: trimmed,
      time: getCurrentTime(),
      color,
    };

    try {
      const { error } = await supabase.from('messages').insert([newMessage]);
      if (error) throw error;
      setInput('');
    } catch (err) {
      console.error('送信エラー:', err.message);
      alert('送信に失敗しました');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('このメッセージを削除しますか？')) {
      await deleteMessage(id);
    }
  };

  const handleUsernameSubmit = () => {
    if (username.trim() !== '') setIsUsernameSet(true);
  };

  const trimmedInput = input.trim();

  const recentMessages = messages.slice(-6);

  const exactMatches = trimmedInput !== ''
    ? recentMessages.filter(
        msg => msg.text === trimmedInput && !isExcluded(msg.text, trimmedInput)
      )
    : [];

  const inputPreview = trimmedInput
    ? {
        id: 'preview',
        user: username,
        text: input,
        time: getCurrentTime(),
        preview: true,
      }
    : null;

  const filteredMessages = messages.filter(msg => {
    if (!trimmedInput) return true;
    const isPartialMatch = msg.text.includes(trimmedInput);
    return !(isPartialMatch && isExcluded(msg.text, trimmedInput));
  });

  const combinedMessages = inputPreview
    ? [...filteredMessages, inputPreview]
    : filteredMessages;

  if (!isUsernameSet) {
    return (
      <div style={{ maxWidth: 400, margin: '50px auto', textAlign: 'center' }}>
        <h2>ユーザー名を入力してください</h2>
        <input
          type="text"
          placeholder="ユーザー名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUsernameSubmit()}
          style={{ padding: 8, fontSize: 16, width: '80%' }}
        />
        <button onClick={handleUsernameSubmit} style={{ padding: '8px 16px', marginLeft: 8 }}>
          入力
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h2>チャットアプリ（Supabase連携＋プレビュー＆検索候補付き）</h2>

      <div ref={logRef} style={{ border: '1px solid #ccc', height: 320, overflowY: 'scroll', padding: 10, marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
        {combinedMessages.map(({ id, user, text, time, preview, color }) => (
          <div key={id} style={{ marginBottom: 12, padding: 8, backgroundColor: preview ? '#fffbe6' : '#eef2f7', borderRadius: 8, position: 'relative', opacity: preview ? 0.6 : 1, fontStyle: preview ? 'italic' : 'normal', wordBreak: 'break-word', color: color || 'black' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {user} {preview && <span style={{ fontSize: 12, color: '#999' }}>(入力中)</span>}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 16, color: color === 'red' ? 'red' : 'black' }}>{text}</div>
            <div style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 12, color: '#888' }}>{time}</div>
            {!preview && (
              <button onClick={() => handleDelete(id)} style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, background: 'transparent', border: 'none', color: 'red', cursor: 'pointer' }}>
                削除
              </button>
            )}
          </div>
        ))}
      </div>

      {exactMatches.length > 0 && (
        <div style={{ marginBottom: 10, padding: 10, backgroundColor: '#fff4e6', border: '1px solid #ffa726', borderRadius: 8 }}>
          <strong>過去に6件以内に同じ内容が {exactMatches.length} 件見つかりました：</strong>
          <ul style={{ paddingLeft: 16, marginTop: 6 }}>
            {exactMatches.map((msg) => (
              <li key={msg.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                <span><strong>{msg.user}</strong>: <span style={{ color: msg.color }}>{msg.text}</span></span>
                <span style={{ color: '#999', whiteSpace: 'nowrap' }}>{msg.time}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          type="text"
          placeholder="メッセージを入力"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.ctrlKey || e.metaKey) {
                sendMessage('black');
              } else {
                sendMessage('red');
              }
            }
          }}
          style={{ flex: 1, padding: 8, fontSize: 16 }}
        />
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          Enter → 流入（赤）　Control+Enter → 掘る（黒）
        </div>
      </div>
    </div>
  );
};

export default SimpleChat;