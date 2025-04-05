import React, { useState, useEffect } from 'react';
import './App.css';
import MiniKitProvider from './components/MiniKitProvider';
import { MiniKit, VerifyCommandInput, VerificationLevel, ISuccessResult } from '@worldcoin/minikit-js'

function App() {
  const [messages, setMessages] = useState([]);
  // const [serverLogs, setServerLogs] = useState([]);
  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isWorldApp, setIsWorldApp] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Testing connection...');
  const [currentResponse, setCurrentResponse] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [miniKitStatus, setMiniKitStatus] = useState('checking'); // 'checking', 'installed', 'not-installed'

  // Update the styles object
  const styles = {
    container: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
    },
    chatContainer: {
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      padding: '20px',
      marginBottom: '20px',
      maxHeight: '500px',
      overflowY: 'auto',
    },
    verificationSection: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      textAlign: 'center',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    },
    statusMessage: {
      padding: '10px',
      marginBottom: '15px',
      borderRadius: '8px',
      backgroundColor: '#f0f4f8',
    },
    errorMessage: {
      backgroundColor: '#fff3f3',
      color: '#d32f2f',
    },
    verifyButton: {
      backgroundColor: '#1976d2',
      color: 'white',
      padding: '12px 24px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      transition: 'background-color 0.3s',
      '&:hover': {
        backgroundColor: '#1565c0',
      },
      '&:disabled': {
        backgroundColor: '#ccc',
        cursor: 'not-allowed',
      },
    },
    inputForm: {
      display: 'flex',
      gap: '10px',
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '12px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    },
    input: {
      flex: 1,
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      fontSize: '16px',
    },
    sendButton: {
      backgroundColor: '#4caf50',
      color: 'white',
      padding: '12px 24px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      transition: 'background-color 0.3s',
      '&:hover': {
        backgroundColor: '#388e3c',
      },
    },
  };

  // Add this chat component
  const ChatMessage = ({ type, sender, message, time }) => {
    const messageStyle = {
      margin: '15px 0',
      padding: '10px 15px',
      borderRadius: '10px',
      maxWidth: '80%',
      ...(type === 'assistant' ? { backgroundColor: '#e3f2fd', marginRight: 'auto' } : 
          type === 'user' ? { backgroundColor: '#f0f4c3', marginLeft: 'auto' } : 
          { backgroundColor: '#fff3e0', fontFamily: 'monospace', wordBreak: 'break-all' }),
    };

    return (
      <div style={messageStyle}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>{sender}</div>
        {message}
        <div style={{ fontSize: '0.8em', color: '#666', marginTop: '5px' }}>{time}</div>
      </div>
    );
  };

  // Test connection on component mount
  useEffect(() => {
    testConnection();
  }, []);

  // Check if running in World App on component mount
  useEffect(() => {
    const checkWorldApp = () => {
      const isInstalled = MiniKit.isInstalled();
      setIsWorldApp(isInstalled);
      if (!isInstalled) {
        console.log('Running in browser - World App features disabled');
      }
    };
    checkWorldApp();
  }, []);

  // Check MiniKit installation on component mount
  useEffect(() => {
    const initializeMiniKit = async () => {
      try {
        // Try to install MiniKit
        await MiniKit.install();
        
        // Check if installation was successful
        if (MiniKit.isInstalled()) {
          console.log('MiniKit installed successfully');
          setMiniKitStatus('installed');
        } else {
          console.log('MiniKit not installed - not in World App');
          setMiniKitStatus('not-installed');
        }
      } catch (error) {
        console.error('MiniKit installation error:', error);
        setMiniKitStatus('not-installed');
      }
    };

    initializeMiniKit();
  }, []);

  const testConnection = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      setConnectionStatus(data.message);
    } catch (error) {
      setConnectionStatus('Connection failed: ' + error.message);
    }
  };

  const sendMessage = async (message) => {
    try {
      // Add user message to chat
      setMessages(prev => [...prev, { role: 'user', content: message }]);
      setStreamingText(''); // Clear previous response

      const response = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      // Read the response as a stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Read the stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Decode the chunk and update the current response
        const text = decoder.decode(value);
        setStreamingText(prev => prev + text);
      }

      // After stream is complete, add the full response to messages
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: streamingText 
      }]);

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Error: ${error.message}` 
      }]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleWorldIDVerification = async () => {
    try {
      setIsVerifying(true);
      
      // Check MiniKit status before proceeding
      if (miniKitStatus !== 'installed') {
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: '⚠️ Please open this app in World App to verify your identity' 
        }]);
        return;
      }

      // First step: Get verification from World ID
      const verifyPayload = {
        action: 'voting-action', // Replace with your action ID
        signal: '0x12312',
        verification_level: 'orb',
      };

      const { finalPayload } = await MiniKit.commandsAsync.verify(verifyPayload);
      
      if (finalPayload.status === 'error') {
        throw new Error(finalPayload.message);
      }

      // Second step: Verify with backend
      const verifyResponse = await fetch('http://localhost:5001/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: finalPayload,
          action: 'voting-action',
          signal: '0x12312'
        }),
      });

      const result = await verifyResponse.json();
      
      if (result.status === 200) {
        setMessages(prev => [...prev, { 
          role: 'system', 
          content: '✅ Verification successful!' 
        }]);
      } else {
        throw new Error(result.message || 'Verification failed');
      }

    } catch (error) {
      console.error('Verification error:', error);
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `❌ Error: ${error.message}` 
      }]);
    } finally {
      setIsVerifying(false);
    }
  };
  
  return (
    <MiniKitProvider>
      <div style={styles.container}>
        {/* Chat Container */}
        <div style={styles.chatContainer}>
          <ChatMessage 
            type="assistant"
            sender="1inch Fusion+ Assistant"
            message="Hello, welcome to 1inch wonderworld. I can help you swap any tokens from/to any chains in the most cost efficient way."
            time="12:01 PM"
          />
          <ChatMessage 
            type="user"
            sender="User"
            message="Please swap xDAI token worth of $8 including any fees. My wallet is 0xf59dA181591dbB122A894372C6E44cC079A7Bb3F"
            time="12:02 PM"
          />
          <ChatMessage 
            type="assistant"
            sender="1inch Fusion+ Assistant"
            message="Yes, please wait for a moment."
            time="12:02 PM"
          />
          <ChatMessage 
            type="assistant"
            sender="1inch Fusion+ Assistant"
            message="Please check your wallet. The swap has been completed."
            time="12:03 PM"
          />
        </div>

        {/* Verification Section */}
        <div style={styles.verificationSection}>
          {miniKitStatus === 'checking' && (
            <div style={styles.statusMessage}>
              Checking World App environment...
            </div>
          )}
          
          {miniKitStatus === 'not-installed' && (
            <div style={{...styles.statusMessage, ...styles.errorMessage}}>
              Please open this app in World App to use verification features
            </div>
          )}

          <button 
            onClick={handleWorldIDVerification}
            style={{
              ...styles.verifyButton,
              ...(isVerifying || miniKitStatus !== 'installed' ? styles.verifyButton['&:disabled'] : {})
            }}
            disabled={isVerifying || miniKitStatus !== 'installed'}
          >
            {isVerifying ? 'Verifying...' : 
             miniKitStatus === 'installed' ? 'Verify with World ID' : 
             'Open in World App to Verify'}
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={styles.inputForm}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            style={styles.input}
          />
          <button type="submit" style={styles.sendButton}>
            Send
          </button>
        </form>
      </div>
    </MiniKitProvider>
  );
}

export default App;