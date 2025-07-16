import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const getCurrentTime = () => {
  const d = new Date();
  return d.toLocaleTimeString();
};

const containsLegalName = (text) => {
  const legalTerms = ['株式会社', '有限会社', '合同会社', 'Inc.', 'LLC', 'G.K.'];
  return legalTerms.some(term => text.includes(term));
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
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
    if (!error) {
      setMessages(data);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !username.trim()) return;
    const newMessage = {
      user: username,
      text: input,
      time: getCurrentTime(),
    };
    await supabase.from('messages').insert([newMessage]);
    setInput('');
  };

  const handleUsernameSubmit = () => {
    if (username.trim() !== '') setIsUsernameSet(true);
  };

  const trimmedInput = input.trim();

  const matchingMessages = messages.filter(
    msg => trimmedInput && msg.text.includes(trimmedInput) && !containsLegalName(msg.text)
  );

  const exactMatches = messages.filter(
    msg => trimmedInput !== '' && msg.text.includes(trimmedInput)
  );

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
    const isLegal = containsLegalName(msg.text);
    return !(isPartialMatch && !isLegal);
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

      {trimmedInput && matchingMessages.length > 0 && (
        <div style={{ marginBottom: 10, padding: 10, backgroundColor: '#fff8dc', border: '1px solid #ccc', borderRadius: 8 }}>
          <strong>過去の一致するメッセージ:</strong>
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: '8px 0' }}>
            {matchingMessages.slice(0, 5).map(msg => (
              <li
                key={msg.id}
                style={{ padding: '4px 0', borderBottom: '1px dashed #ddd', display: 'flex', justifyContent: 'space-between', fontSize: 14 }}
              >
                <span><strong>{msg.user}</strong>: {msg.text}</span>
                <span style={{ color: '#999', marginLeft: 8, whiteSpace: 'nowrap' }}>{msg.time}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        ref={logRef}
        style={{ border: '1px solid #ccc', height: 320, overflowY: 'scroll', padding: 10, marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 8 }}
      >
        {combinedMessages.map(({ id, user, text, time, preview }) => (
          <div
            key={id}
            style={{ marginBottom: 12, padding: 8, backgroundColor: preview ? '#fffbe6' : '#eef2f7', borderRadius: 8, position: 'relative', opacity: preview ? 0.6 : 1, fontStyle: preview ? 'italic' : 'normal', wordBreak: 'break-word' }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {user} {preview && <span style={{ fontSize: 12, color: '#999' }}>(入力中)</span>}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 16 }}>{text}</div>
            <div style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 12, color: '#888' }}>{time}</div>
          </div>
        ))}
      </div>

      {exactMatches.length > 0 && (
        <div style={{ marginBottom: 10, padding: 10, backgroundColor: '#fff4e6', border: '1px solid #ffa726', borderRadius: 8 }}>
          <strong>過去に同じ内容が {exactMatches.length} 件見つかりました：</strong>
          <ul style={{ paddingLeft: 16, marginTop: 6 }}>
            {exactMatches.map((msg) => (
              <li
                key={msg.id}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}
              >
                <span><strong>{msg.user}</strong>: {msg.text}</span>
                <span style={{ color: '#999', whiteSpace: 'nowrap' }}>{msg.time}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="メッセージを入力"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          style={{ flex: 1, padding: 8, fontSize: 16 }}
        />
        <button onClick={sendMessage} style={{ padding: '8px 16px' }}>
          送信
        </button>
      </div>
    </div>
  );
};

export default SimpleChat;
