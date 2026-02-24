import React, { useState, useEffect, useRef } from 'react';
import * as socket from '../network/socket';

const MAX_MESSAGES = 100;

const styles = {
  container: {
    height: '150px',
    overflowY: 'auto',
    padding: '8px 10px',
    background: '#1a1a2e',
    fontFamily: 'sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  chat: {
    color: '#eee',
  },
  name: {
    fontWeight: 'bold',
    color: '#7cb3ff',
  },
  system: {
    color: '#888',
    fontStyle: 'italic',
  },
};

export default function ChatLog() {
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    function onChat(data) {
      setMessages((prev) => {
        const next = [...prev, { type: 'chat', name: data.name, text: data.message }];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    }

    function onJoined(data) {
      setMessages((prev) => {
        const next = [...prev, { type: 'join', name: data.name }];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    }

    function onLeft(data) {
      setMessages((prev) => {
        const next = [...prev, { type: 'leave', name: data.name || data.id }];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    }

    socket.on('chatMessage', onChat);
    socket.on('penguinJoined', onJoined);
    socket.on('penguinLeft', onLeft);

    return () => {
      socket.off('chatMessage', onChat);
      socket.off('penguinJoined', onJoined);
      socket.off('penguinLeft', onLeft);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={styles.container}>
      {messages.map((msg, i) => {
        if (msg.type === 'chat') {
          return (
            <div key={i} style={styles.chat}>
              <span style={styles.name}>{msg.name}: </span>
              {msg.text}
            </div>
          );
        }
        return (
          <div key={i} style={styles.system}>
            {msg.name} {msg.type === 'join' ? 'joined the room' : 'left the room'}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
