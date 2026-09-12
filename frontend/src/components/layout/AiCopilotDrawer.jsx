import React, { useState } from 'react';
import { Bot, X, Send, Sparkles, ArrowRight, ShieldCheck, Activity, HelpCircle } from 'lucide-react';
import { aiService } from '../../services/aiService';

export default function AiCopilotDrawer({
  isOpen,
  onClose,
  contextData = {},
  onNavigateTab
}) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'NEXUS City Intelligence Copilot online. Telemetry stream is synchronized. How may I assist your surveillance operations today?'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  if (!isOpen) return null;

  const suggestedQuestions = [
    'Summarize current traffic.',
    'Which cameras have the highest activity?',
    'Show recent alerts.',
    'Which vehicles have been seen across multiple cameras?',
    'Which cameras are offline?',
    'Show the journey of vehicle NEXUS_V00042.'
  ];

  const handleSend = (textToSend) => {
    const q = (textToSend || inputQuery).trim();
    if (!q) return;

    const userMsg = { id: Date.now(), sender: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');
    setIsThinking(true);

    setTimeout(() => {
      const response = aiService.askSituationalQuestion(q, contextData);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: response.reply,
          action: response.action
        }
      ]);
      setIsThinking(false);
    }, 450);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '420px',
      maxWidth: '90vw',
      background: 'rgba(11, 17, 30, 0.98)',
      backdropFilter: 'blur(16px)',
      borderLeft: '1px solid var(--border-medium)',
      boxShadow: '-15px 0 40px rgba(0, 0, 0, 0.8)',
      zIndex: 2200,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Drawer Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(7, 10, 17, 0.7)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(0,242,254,0.2) 0%, rgba(168,85,247,0.2) 100%)',
            border: '1px solid var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <Bot size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff', letterSpacing: '0.5px' }}>
                NEXUS AI
              </span>
              <span className="client-derived-tag" style={{ fontSize: '0.58rem' }}>
                COPILOT UI
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 6px var(--accent-emerald)' }} />
              <span>CITY INTELLIGENCE COPILOT ● READY</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Notice Banner: Technical Honesty */}
      <div style={{
        padding: '8px 16px',
        background: 'rgba(0, 242, 254, 0.04)',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: '0.68rem',
        color: 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <ShieldCheck size={13} color="var(--accent-cyan)" />
        <span>Situational analysis derived from in-memory surveillance telemetry.</span>
      </div>

      {/* Chat Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{
              padding: '10px 14px',
              borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.sender === 'user'
                ? 'linear-gradient(135deg, rgba(0,242,254,0.2) 0%, rgba(79,172,254,0.2) 100%)'
                : 'rgba(255, 255, 255, 0.04)',
              border: msg.sender === 'user' ? '1px solid var(--border-medium)' : '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.8rem',
              lineHeight: '1.45',
              whiteSpace: 'pre-line'
            }}>
              {msg.text}
            </div>

            {msg.action && (
              <button
                onClick={() => {
                  onNavigateTab?.(msg.action.tab);
                  onClose();
                }}
                className="btn btn-outline"
                style={{
                  alignSelf: 'flex-start',
                  padding: '4px 10px',
                  fontSize: '0.7rem',
                  marginTop: '2px',
                  color: 'var(--accent-cyan)'
                }}
              >
                <span>{msg.action.label}</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        ))}

        {isThinking && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '8px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-dim)',
            fontSize: '0.74rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={13} color="var(--accent-cyan)" />
            <span>Analyzing corridor telemetry...</span>
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(7, 10, 17, 0.5)'
      }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Suggested Situational Inquiries:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.69rem',
                cursor: 'pointer',
                transition: 'var(--transition)',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                e.currentTarget.style.color = 'var(--accent-cyan)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '8px',
          background: 'rgba(11, 17, 30, 0.9)'
        }}
      >
        <input
          type="text"
          className="input-control"
          placeholder="Ask copilot about traffic, alerts, vehicles..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          style={{ flex: 1, fontSize: '0.82rem' }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: '8px 14px' }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
