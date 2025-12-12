import { useState, useRef, useEffect } from 'react';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Dodaj uporabnikovo sporočilo
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Napaka pri komunikaciji s serverjem');
      }

      const data = await response.json();
      
      // Dodaj AI odgovor
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response 
      }]);
    } catch (error) {
      console.error('Napaka:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '⚠️ Napaka pri komunikaciji s serverjem. Preveri ali backend teče.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🤖 AI SQL Chat (Gemini)</h1>
        <p style={styles.subtitle}>Vprašaj me karkoli o SQL bazi zaposlenih</p>
      </div>

      <div style={styles.chatContainer}>
        <div style={styles.messagesContainer}>
          {messages.length === 0 && (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>👋 Pozdravljeni! Vprašajte me karkoli o zaposlenih v bazi.</p>
              <div style={styles.suggestions}>
                <button 
                  style={styles.suggestionButton}
                  onClick={() => setInput('Prikaži seznam vseh zaposlenih')}
                >
                  Prikaži seznam zaposlenih
                </button>
                <button 
                  style={styles.suggestionButton}
                  onClick={() => setInput('Koliko je povprečna plača?')}
                >
                  Povprečna plača
                </button>
                <button 
                  style={styles.suggestionButton}
                  onClick={() => setInput('Koliko zaposlenih imamo?')}
                >
                  Število zaposlenih
                </button>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                ...styles.message,
                ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage)
              }}
            >
              <div style={styles.messageRole}>
                {msg.role === 'user' ? '👤 Vi' : '🤖 AI'}
              </div>
              <div style={{
                ...styles.messageContent,
                ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble)
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{...styles.message, ...styles.assistantMessage}}>
              <div style={styles.messageRole}>🤖 AI</div>
              <div style={{...styles.messageContent, ...styles.assistantBubble}}>
                <div style={styles.loadingDots}>
                  <span>●</span>
                  <span>●</span>
                  <span>●</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} style={styles.inputForm}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Vprašajte o SQL bazi..."
            style={styles.input}
            disabled={loading}
          />
          <button 
            type="submit" 
            style={{
              ...styles.sendButton,
              ...(loading || !input.trim() ? styles.sendButtonDisabled : {})
            }}
            disabled={loading || !input.trim()}
          >
            {loading ? '⏳' : '📤'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    padding: '2rem',
    textAlign: 'center',
    color: 'white',
  },
  title: {
    margin: '0 0 0.5rem 0',
    fontSize: '2.5rem',
    fontWeight: '700',
  },
  subtitle: {
    margin: 0,
    fontSize: '1.1rem',
    opacity: 0.9,
  },
  chatContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '900px',
    width: '100%',
    margin: '0 auto',
    padding: '0 1rem 1rem',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '16px 16px 0 0',
    padding: '2rem',
    overflowY: 'auto',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
    minHeight: '400px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
  },
  emptyText: {
    fontSize: '1.2rem',
    color: '#666',
    marginBottom: '2rem',
  },
  suggestions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxWidth: '400px',
    margin: '0 auto',
  },
  suggestionButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#f0f0f0',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    transition: 'all 0.2s',
    fontWeight: '500',
  },
  message: {
    marginBottom: '1.5rem',
    animation: 'fadeIn 0.3s ease-in',
  },
  userMessage: {
    textAlign: 'right',
  },
  assistantMessage: {
    textAlign: 'left',
  },
  messageRole: {
    fontSize: '0.85rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
    opacity: 0.7,
  },
  messageContent: {
    display: 'inline-block',
    padding: '1rem 1.25rem',
    borderRadius: '16px',
    maxWidth: '85%',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  userBubble: {
    backgroundColor: '#667eea',
    color: 'white',
  },
  assistantBubble: {
    backgroundColor: '#f5f5f5',
    color: '#333',
  },
  inputForm: {
    display: 'flex',
    gap: '0.75rem',
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0 0 16px 16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  input: {
    flex: 1,
    padding: '1rem 1.25rem',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  sendButton: {
    padding: '1rem 1.5rem',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.25rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontWeight: '600',
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  loadingDots: {
    display: 'inline-flex',
    gap: '0.25rem',
  },
};

export default App;