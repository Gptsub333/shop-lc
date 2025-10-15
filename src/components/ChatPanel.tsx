// import { useState, useEffect, useRef } from "react";
// import { X, Send, Mic, MessageCircle, User, Bot } from "lucide-react";

// interface ChatPanelProps {
//   isOpen: boolean;
//   onClose: () => void;
// }

// interface Message {
//   id: string;
//   text: string;
//   sender: "user" | "assistant";
//   timestamp: number;
// }

// interface WebSocketMessage {
//   type: string;
//   data: {
//     message?: string;
//     session_id?: string;
//     audio?: string;
//     [key: string]: any;
//   };
// }

// const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [ws, setWs] = useState<WebSocket | null>(null);
//   const [isConnecting, setIsConnecting] = useState(false);
//   const [userInput, setUserInput] = useState("");
//   const [micActive, setMicActive] = useState(false);

//   const wsRef = useRef<WebSocket | null>(null);
//   const micSocket = useRef<WebSocket | null>(null);
//   const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
//   const isOpenRef = useRef(isOpen);
//   const scrollRef = useRef<HTMLDivElement>(null);

//   // Mic recording refs
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const processorRef = useRef<ScriptProcessorNode | null>(null);
//   const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

//   // Audio playback refs (for buffering)
//   const playbackContextRef = useRef<AudioContext | null>(null);
//   const audioQueueRef = useRef<Int16Array[]>([]);
//   const isPlayingRef = useRef(false);
//   const nextPlayTimeRef = useRef(0);
//   const [currentSampleRate, setCurrentSampleRate] = useState(8000); // Start with 8kHz (matches config)

//   const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_URL_WS || 'ws://34.228.228.93:5001';

//   // ------------------------------------------------------------
//   // WebSocket setup for messages (text + transcription stream)
//   // ------------------------------------------------------------
//   useEffect(() => {
//     isOpenRef.current = isOpen;
//   }, [isOpen]);

//   useEffect(() => {
//     if (!isOpen) {
//       if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//         wsRef.current.close();
//         wsRef.current = null;
//       }
//       if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
//       setIsConnecting(false);
//       return;
//     }

//     if (isConnecting || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) return;

//     setIsConnecting(true);
//     const websocketUrl = `${BACKEND_WS_URL}/frontend-updates`;
//     console.log("Connecting to:", websocketUrl);

//     const websocket = new WebSocket(websocketUrl);
//     wsRef.current = websocket;

//     websocket.onopen = () => {
//       console.log("✅ Connected to backend");
//       setWs(websocket);
//       setIsConnecting(false);
//     };

//     websocket.onmessage = (event) => {
//       try {
//         const data: WebSocketMessage = JSON.parse(event.data);
//         handleWebSocketMessage(data);
//       } catch (err) {
//         console.error("Error parsing WS message:", err);
//       }
//     };

//     websocket.onclose = (e) => {
//       console.log("Disconnected:", e.code, e.reason);
//       wsRef.current = null;
//       setWs(null);
//       setIsConnecting(false);
//       if (isOpenRef.current && e.code !== 1000) {
//         reconnectTimeoutRef.current = setTimeout(() => {
//           if (isOpenRef.current) setIsConnecting(false);
//         }, 3000);
//       }
//     };

//     websocket.onerror = (err) => {
//       console.error("WS error:", err);
//       setIsConnecting(false);
//     };
//   }, [isOpen, isConnecting, BACKEND_WS_URL]);

//   // ------------------------------------------------------------
//   // Audio Playback with Buffering Queue
//   // ------------------------------------------------------------

//   // Decode μ-law to linear PCM16
//   const decodeMuLaw = (muLawByte: number): number => {
//     muLawByte = ~muLawByte;
//     const sign = muLawByte & 0x80;
//     const exponent = (muLawByte >> 4) & 0x07;
//     const mantissa = muLawByte & 0x0F;

//     let sample = ((mantissa << 3) + 0x84) << exponent;
//     sample = sample - 0x84;

//     return sign !== 0 ? -sample : sample;
//   };

//   const initPlaybackContext = () => {
//     if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
//       playbackContextRef.current = new AudioContext({ sampleRate: currentSampleRate });
//       nextPlayTimeRef.current = playbackContextRef.current.currentTime;
//       console.log(`🎵 Audio context initialized at ${currentSampleRate}Hz`);
//     }
//   };

//   const playDeepgramAudio = async (base64Audio: string) => {
//     try {
//       // Decode base64
//       const audioBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));

//       // Decode μ-law to PCM16
//       const int16Array = new Int16Array(audioBytes.length);
//       for (let i = 0; i < audioBytes.length; i++) {
//         int16Array[i] = decodeMuLaw(audioBytes[i]);
//       }

//       console.log(`📦 Queued ${int16Array.length} samples (${(int16Array.length / currentSampleRate).toFixed(3)}s at ${currentSampleRate}Hz μ-law)`);

//       // Add to queue
//       audioQueueRef.current.push(int16Array);

//       // Start playing if not already playing
//       if (!isPlayingRef.current) {
//         isPlayingRef.current = true;
//         processAudioQueue();
//       }
//     } catch (err) {
//       console.error("❌ Audio decode error:", err);
//     }
//   };

//   const processAudioQueue = async () => {
//     initPlaybackContext();

//     const context = playbackContextRef.current!;

//     while (audioQueueRef.current.length > 0) {
//       const chunk = audioQueueRef.current.shift()!;

//       // Create audio buffer for this chunk
//       const audioBuffer = context.createBuffer(1, chunk.length, currentSampleRate);
//       const channelData = audioBuffer.getChannelData(0);

//       // Convert PCM16 to Float32
//       for (let i = 0; i < chunk.length; i++) {
//         channelData[i] = chunk[i] / 32768.0;
//       }

//       // Schedule playback
//       const source = context.createBufferSource();
//       source.buffer = audioBuffer;
//       source.connect(context.destination);

//       // Calculate when to play this chunk
//       const currentTime = context.currentTime;
//       const startTime = Math.max(currentTime, nextPlayTimeRef.current);

//       source.start(startTime);

//       // Update next play time
//       nextPlayTimeRef.current = startTime + audioBuffer.duration;

//       console.log(`🔊 Playing chunk at ${startTime.toFixed(3)}s, duration: ${audioBuffer.duration.toFixed(3)}s`);

//       // Wait a bit before processing next chunk
//       await new Promise(resolve => setTimeout(resolve, 10));
//     }

//     isPlayingRef.current = false;
//     console.log("✅ Audio queue finished");
//   };

//   // Change sample rate and restart audio context
//   const changeSampleRate = (rate: number) => {
//     console.log(`🔄 Changing sample rate to ${rate}Hz`);

//     // Close existing context
//     if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
//       playbackContextRef.current.close();
//       playbackContextRef.current = null;
//     }

//     // Clear queue
//     audioQueueRef.current = [];
//     isPlayingRef.current = false;

//     // Set new rate
//     setCurrentSampleRate(rate);
//   };

//   // ------------------------------------------------------------
//   // Mic streaming → backend (/client-audio)
//   // ------------------------------------------------------------

//   // Encode linear PCM16 to μ-law
//   const encodeMuLaw = (sample: number): number => {
//     const MULAW_MAX = 0x1FFF;
//     const MULAW_BIAS = 33;

//     const sign = sample < 0 ? 0x80 : 0x00;
//     let absValue = Math.abs(Math.floor(sample));

//     if (absValue > MULAW_MAX) absValue = MULAW_MAX;
//     absValue += MULAW_BIAS;

//     let exponent = 7;
//     for (let exp = 0; exp < 8; exp++) {
//       if (absValue <= (0x1F << (exp + 2))) {
//         exponent = exp;
//         break;
//       }
//     }

//     const mantissa = (absValue >> (exponent + 3)) & 0x0F;
//     const muLawByte = ~(sign | (exponent << 4) | mantissa);

//     return muLawByte & 0xFF;
//   };

//   const startMicStream = async () => {
//     if (micActive) {
//       stopMicStream();
//       return;
//     }

//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       // Use 8kHz to match backend config
//       const audioContext = new AudioContext({ sampleRate: 8000 });
//       audioContextRef.current = audioContext;

//       const source = audioContext.createMediaStreamSource(stream);
//       sourceRef.current = source;

//       const processor = audioContext.createScriptProcessor(4096, 1, 1);
//       processorRef.current = processor;

//       const audioSocketUrl = `${BACKEND_WS_URL}/client-audio`;
//       console.log("🎤 Connecting to audio endpoint:", audioSocketUrl);

//       const socket = new WebSocket(audioSocketUrl);
//       micSocket.current = socket;

//       socket.onopen = () => {
//         console.log("🎤 Mic stream connected! (8kHz μ-law)");
//         setMicActive(true);

//         processor.onaudioprocess = (e) => {
//           if (socket.readyState !== WebSocket.OPEN) return;

//           const inputData = e.inputBuffer.getChannelData(0);
//           const muLawData = new Uint8Array(inputData.length);

//           // Convert Float32 to PCM16, then encode to μ-law
//           for (let i = 0; i < inputData.length; i++) {
//             const pcm16 = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
//             muLawData[i] = encodeMuLaw(pcm16);
//           }

//           // Send μ-law encoded data
//           socket.send(muLawData.buffer);
//         };

//         source.connect(processor);
//         processor.connect(audioContext.destination);
//       };

//       socket.onmessage = (event) => {
//         try {
//           if (typeof event.data === 'string') {
//             const data = JSON.parse(event.data);
//             console.log("🎧 Received from backend:", data.type);

//             if (data.type === 'audio') {
//               console.log("🔊 Playing audio response");
//               playDeepgramAudio(data.data);
//             }
//           } else if (event.data instanceof Blob) {
//             console.log("🎧 Received binary audio");
//             event.data.arrayBuffer().then(buffer => {
//               const audioBytes = new Uint8Array(buffer);
//               const int16Array = new Int16Array(audioBytes.buffer);
//               audioQueueRef.current.push(int16Array);
//               if (!isPlayingRef.current) {
//                 isPlayingRef.current = true;
//                 processAudioQueue();
//               }
//             });
//           }
//         } catch (err) {
//           console.error("❌ Error handling mic socket message:", err);
//         }
//       };

//       socket.onerror = (err) => {
//         console.error("🎙️ Mic socket error:", err);
//         stopMicStream();
//       };

//       socket.onclose = () => {
//         console.log("🎙️ Mic socket closed");
//         stopMicStream();
//       };

//     } catch (err) {
//       console.error("❌ Error starting mic stream:", err);
//       alert("Could not access microphone. Please check permissions.");
//     }
//   };

//   const stopMicStream = () => {
//     setMicActive(false);

//     if (micSocket.current) {
//       micSocket.current.close();
//       micSocket.current = null;
//     }

//     if (processorRef.current) {
//       processorRef.current.disconnect();
//       processorRef.current = null;
//     }

//     if (sourceRef.current) {
//       sourceRef.current.disconnect();
//       sourceRef.current = null;
//     }

//     if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
//       audioContextRef.current.close();
//       audioContextRef.current = null;
//     }
//   };

//   // ------------------------------------------------------------
//   // Handle incoming backend messages
//   // ------------------------------------------------------------
//   const handleWebSocketMessage = (data: WebSocketMessage) => {
//     switch (data.type) {
//       case "transcription":
//         appendMessage("user", data.data.message || "");
//         break;
//       case "ai_response":
//         appendMessage("assistant", data.data.message || "");
//         break;
//       case "audio_chunk":
//         if (data.data.audio) playDeepgramAudio(data.data.audio);
//         break;
//       case "session_started":
//         console.log("🎧 Voice session started");
//         break;
//       case "session_ended":
//         console.log("🔚 Voice session ended");
//         break;
//       default:
//         console.log("Unknown message type:", data.type);
//     }
//   };

//   const appendMessage = (sender: "user" | "assistant", text: string) => {
//     if (!text.trim()) return;
//     const newMsg: Message = {
//       id: `${sender}-${Date.now()}-${Math.random()}`,
//       text,
//       sender,
//       timestamp: Date.now()
//     };
//     setMessages((prev) => [...prev, newMsg]);
//   };

//   // ------------------------------------------------------------
//   // Text sending handler
//   // ------------------------------------------------------------
//   const sendTextMessage = () => {
//     if (!userInput.trim()) return;
//     appendMessage("user", userInput);
//     wsRef.current?.send(
//       JSON.stringify({ type: "text_message", data: { message: userInput } })
//     );
//     setUserInput("");
//   };

//   // ------------------------------------------------------------
//   // Cleanup
//   // ------------------------------------------------------------
//   useEffect(() => {
//     if (!isOpen) {
//       setMessages([]);
//       stopMicStream();
//       window.speechSynthesis.cancel();

//       // Clear audio queue and close playback context
//       audioQueueRef.current = [];
//       isPlayingRef.current = false;
//       if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
//         playbackContextRef.current.close();
//         playbackContextRef.current = null;
//       }
//     }
//   }, [isOpen]);

//   useEffect(() => {
//     if (scrollRef.current)
//       scrollRef.current.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   if (!isOpen) return null;

//   // ------------------------------------------------------------
//   // Render
//   // ------------------------------------------------------------
//   return (
//     <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col rounded-t-2xl mr-2.5 h-[95%] mt-[30px]">
//       {/* Header */}
//       <div className="p-6 flex items-center justify-between bg-gradient-to-br from-green-800 to-green-900 rounded-t-2xl">
//         <div className="flex items-center gap-4">
//           <div className="h-10 w-10 rounded-full bg-green-700 flex items-center justify-center shadow-md border border-green-600">
//             <MessageCircle className="h-5 w-5 text-white" />
//           </div>
//           <div>
//             <h2 className="font-bold text-md text-white">Voice Agent</h2>
//             <p className="text-xs text-green-200">
//               {ws && ws.readyState === WebSocket.OPEN
//                 ? "Connected"
//                 : isConnecting
//                   ? "Connecting..."
//                   : "Disconnected"}
//             </p>
//           </div>
//         </div>
//         <button
//           onClick={onClose}
//           className="text-white hover:bg-green-700 p-2 rounded-full transition-all hover:scale-110"
//         >
//           <X className="h-6 w-6" />
//         </button>
//       </div>

//       {/* Messages */}
//       <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
//         {/* Sample Rate Selector */}
//         <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
//           <p className="text-xs font-semibold text-blue-800 mb-2">Audio Sample Rate: {currentSampleRate}Hz</p>
//           <div className="flex gap-2 flex-wrap">
//             {[8000, 16000, 24000, 48000].map(rate => (
//               <button
//                 key={rate}
//                 onClick={() => changeSampleRate(rate)}
//                 className={`px-3 py-1 text-xs rounded ${currentSampleRate === rate
//                     ? "bg-blue-600 text-white"
//                     : "bg-white text-blue-600 border border-blue-300 hover:bg-blue-100"
//                   }`}
//               >
//                 {rate / 1000}kHz
//               </button>
//             ))}
//           </div>
//           <p className="text-xs text-blue-600 mt-2">👆 Try different rates if audio sounds wrong</p>
//         </div>

//         {messages.map((msg) => (
//           <div
//             key={msg.id}
//             className={`flex mb-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
//           >
//             {msg.sender === "assistant" && (
//               <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-600 flex items-center justify-center shadow-md mr-2">
//                 <Bot className="h-4 w-4 text-white" />
//               </div>
//             )}
//             <div
//               className={`max-w-[75%] p-3 rounded-2xl shadow-sm ${msg.sender === "user"
//                 ? "bg-blue-500 text-white rounded-br-none"
//                 : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
//                 }`}
//             >
//               {msg.text}
//             </div>
//             {msg.sender === "user" && (
//               <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center shadow-md ml-2">
//                 <User className="h-4 w-4 text-white" />
//               </div>
//             )}
//           </div>
//         ))}
//         <div ref={scrollRef} />
//       </div>

//       {/* Input */}
//       <div className="p-4 border-t bg-white flex items-center gap-2">
//         <button
//           onClick={startMicStream}
//           className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${micActive
//             ? "bg-red-500 text-white animate-pulse"
//             : "bg-green-600 text-white hover:bg-green-700"
//             }`}
//           title={micActive ? "Stop recording" : "Start recording"}
//         >
//           <Mic className="h-5 w-5" />
//         </button>
//         <input
//           type="text"
//           className="flex-1 h-12 border-2 border-gray-200 rounded-xl px-4 focus:outline-none"
//           placeholder="Type your message..."
//           value={userInput}
//           onChange={(e) => setUserInput(e.target.value)}
//           onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
//         />
//         <button
//           onClick={sendTextMessage}
//           className="h-12 w-12 rounded-xl bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
//         >
//           <Send className="h-5 w-5" />
//         </button>
//       </div>
//     </div>
//   );
// };

// export default ChatPanel;


import { useState, useEffect, useRef } from "react";
import { X, Send, Mic, MessageCircle, User, Bot } from "lucide-react";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: number;
}

interface WebSocketMessage {
  type: string;
  data: {
    message?: string;
    session_id?: string;
    audio?: string;
    [key: string]: any;
  };
}

const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [showSampleRates, setShowSampleRates] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const micSocket = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOpenRef = useRef(isOpen);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mic recording refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Audio playback refs (for buffering)
  const playbackContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const [currentSampleRate, setCurrentSampleRate] = useState(8000); // Start with 8kHz (matches config)

  // const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_URL_WS || 'wss://34.228.228.93:5001';
  // const BACKEND_WS_URL = 'http://34.228.228.93:5001';
  const BACKEND_WS_URL = 'wss://shoplc.holbox.ai';


  // ------------------------------------------------------------
  // WebSocket setup for messages (text + transcription stream)
  // ------------------------------------------------------------
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      setIsConnecting(false);
      return;
    }

    if (isConnecting || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) return;

    setIsConnecting(true);
    const websocketUrl = `${BACKEND_WS_URL}/frontend-updates`;
    console.log("Connecting to:", websocketUrl);

    const websocket = new WebSocket(websocketUrl);
    wsRef.current = websocket;

    websocket.onopen = () => {
      console.log("✅ Connected to backend");
      setWs(websocket);
      setIsConnecting(false);
    };

    websocket.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    websocket.onclose = (e) => {
      console.log("Disconnected:", e.code, e.reason);
      wsRef.current = null;
      setWs(null);
      setIsConnecting(false);
      if (isOpenRef.current && e.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isOpenRef.current) setIsConnecting(false);
        }, 3000);
      }
    };

    websocket.onerror = (err) => {
      console.error("WS error:", err);
      setIsConnecting(false);
    };
  }, [isOpen, isConnecting, BACKEND_WS_URL]);

  // ------------------------------------------------------------
  // Audio Playback with Buffering Queue
  // ------------------------------------------------------------

  // Decode μ-law to linear PCM16
  const decodeMuLaw = (muLawByte: number): number => {
    muLawByte = ~muLawByte;
    const sign = muLawByte & 0x80;
    const exponent = (muLawByte >> 4) & 0x07;
    const mantissa = muLawByte & 0x0F;

    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample = sample - 0x84;

    return sign !== 0 ? -sample : sample;
  };

  const initPlaybackContext = () => {
    if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
      playbackContextRef.current = new AudioContext({ sampleRate: currentSampleRate });
      nextPlayTimeRef.current = playbackContextRef.current.currentTime;
      console.log(`🎵 Audio context initialized at ${currentSampleRate}Hz`);
    }
  };

  const playDeepgramAudio = async (base64Audio: string) => {
    try {
      // Decode base64
      const audioBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));

      // Decode μ-law to PCM16
      const int16Array = new Int16Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        int16Array[i] = decodeMuLaw(audioBytes[i]);
      }

      console.log(`📦 Queued ${int16Array.length} samples (${(int16Array.length / currentSampleRate).toFixed(3)}s at ${currentSampleRate}Hz μ-law)`);

      // Add to queue
      audioQueueRef.current.push(int16Array);

      // Start playing if not already playing
      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        processAudioQueue();
      }
    } catch (err) {
      console.error("❌ Audio decode error:", err);
    }
  };

  const processAudioQueue = async () => {
    initPlaybackContext();

    const context = playbackContextRef.current!;

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;

      // Create audio buffer for this chunk
      const audioBuffer = context.createBuffer(1, chunk.length, currentSampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // Convert PCM16 to Float32
      for (let i = 0; i < chunk.length; i++) {
        channelData[i] = chunk[i] / 32768.0;
      }

      // Schedule playback
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);

      // Calculate when to play this chunk
      const currentTime = context.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);

      source.start(startTime);

      // Update next play time
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      console.log(`🔊 Playing chunk at ${startTime.toFixed(3)}s, duration: ${audioBuffer.duration.toFixed(3)}s`);

      // Wait a bit before processing next chunk
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    isPlayingRef.current = false;
    console.log("✅ Audio queue finished");
  };

  // Change sample rate and restart audio context
  const changeSampleRate = (rate: number) => {
    console.log(`🔄 Changing sample rate to ${rate}Hz`);

    // Close existing context
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    // Clear queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    // Set new rate
    setCurrentSampleRate(rate);
  };

  // ------------------------------------------------------------
  // Mic streaming → backend (/client-audio)
  // ------------------------------------------------------------

  // Encode linear PCM16 to μ-law
  const encodeMuLaw = (sample: number): number => {
    const MULAW_MAX = 0x1FFF;
    const MULAW_BIAS = 33;

    const sign = sample < 0 ? 0x80 : 0x00;
    let absValue = Math.abs(Math.floor(sample));

    if (absValue > MULAW_MAX) absValue = MULAW_MAX;
    absValue += MULAW_BIAS;

    let exponent = 7;
    for (let exp = 0; exp < 8; exp++) {
      if (absValue <= (0x1F << (exp + 2))) {
        exponent = exp;
        break;
      }
    }

    const mantissa = (absValue >> (exponent + 3)) & 0x0F;
    const muLawByte = ~(sign | (exponent << 4) | mantissa);

    return muLawByte & 0xFF;
  };

  const startMicStream = async () => {
    if (micActive) {
      stopMicStream();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Use 8kHz to match backend config
      const audioContext = new AudioContext({ sampleRate: 8000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const audioSocketUrl = `${BACKEND_WS_URL}/client-audio`;
      console.log("🎤 Connecting to audio endpoint:", audioSocketUrl);

      const socket = new WebSocket(audioSocketUrl);
      micSocket.current = socket;

      socket.onopen = () => {
        console.log("🎤 Mic stream connected! (8kHz μ-law)");
        setMicActive(true);

        processor.onaudioprocess = (e) => {
          if (socket.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          const muLawData = new Uint8Array(inputData.length);

          // Convert Float32 to PCM16, then encode to μ-law
          for (let i = 0; i < inputData.length; i++) {
            const pcm16 = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            muLawData[i] = encodeMuLaw(pcm16);
          }

          // Send μ-law encoded data
          socket.send(muLawData.buffer);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      socket.onmessage = (event) => {
        try {
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);

            if (data.type === 'audio') {
              playDeepgramAudio(data.data);
            }
          }
        } catch (err) {
          console.error("❌ Error handling mic socket message:", err);
        }
      };

      socket.onerror = (err) => {
        console.error("🎙️ Mic socket error:", err);
        stopMicStream();
      };

      socket.onclose = () => {
        console.log("🎙️ Mic socket closed");
        stopMicStream();
      };

    } catch (err) {
      console.error("❌ Error starting mic stream:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopMicStream = () => {
    setMicActive(false);

    if (micSocket.current) {
      micSocket.current.close();
      micSocket.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // ------------------------------------------------------------
  // Handle incoming backend messages
  // ------------------------------------------------------------
  const handleWebSocketMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case "transcription":
        appendMessage("user", data.data.message || "");
        console.log("🗣️ Transcription received:", data.data.message);
        break;
      case "ai_response":
        appendMessage("assistant", data.data.message || "");
        break;
      case "audio_chunk":
        // Don't play audio here - it's already being played through /client-audio socket
        console.log("📻 Audio chunk received (skipping - using direct audio stream)");
        break;
      case "session_started":
        console.log("🎧 Voice session started");
        break;
      case "session_ended":
        console.log("🔚 Voice session ended");
        break;
      default:
        console.log("Unknown message type:", data.type);
    }
  };

  const appendMessage = (sender: "user" | "assistant", text: string) => {
    if (!text.trim()) return;
    const newMsg: Message = {
      id: `${sender}-${Date.now()}-${Math.random()}`,
      text,
      sender,
      timestamp: Date.now()
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  // ------------------------------------------------------------
  // Text sending handler
  // ------------------------------------------------------------
  const sendTextMessage = () => {
    if (!userInput.trim()) return;
    appendMessage("user", userInput);
    wsRef.current?.send(
      JSON.stringify({ type: "text_message", data: { message: userInput } })
    );
    setUserInput("");
  };

  // ------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      stopMicStream();
      window.speechSynthesis.cancel();

      // Clear audio queue and close playback context
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
        playbackContextRef.current.close();
        playbackContextRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col rounded-t-2xl mr-2.5 h-[95%] mt-[30px]">
      {/* Header */}
      <div className="p-6 flex items-center justify-between bg-gradient-to-br from-green-800 to-green-900 rounded-t-2xl">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-green-700 flex items-center justify-center shadow-md border border-green-600">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-md text-white">Voice Agent</h2>
            <p className="text-xs text-green-200">
              {ws && ws.readyState === WebSocket.OPEN
                ? micActive
                  ? "🎤 Listening..."
                  : "Connected"
                : isConnecting
                  ? "Connecting..."
                  : "Disconnected"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-green-700 p-2 rounded-full transition-all hover:scale-110"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {/* Sample Rate Selector */}
        {/*  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-semibold text-blue-800 mb-2">Audio Sample Rate: {currentSampleRate}Hz</p>
          <div className="flex gap-2 flex-wrap">
            {[8000, 16000, 24000, 48000].map(rate => (
              <button
                key={rate}
                onClick={() => changeSampleRate(rate)}
                className={`px-3 py-1 text-xs rounded ${currentSampleRate === rate
                  ? "bg-blue-600 text-white"
                  : "bg-white text-blue-600 border border-blue-300 hover:bg-blue-100"
                  }`}
              >
                {rate / 1000}kHz
              </button>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-2">👆 Try different rates if audio sounds wrong</p>
        </div> */}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex mb-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.sender === "assistant" && (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-600 flex items-center justify-center shadow-md mr-2">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[75%] p-3 rounded-2xl shadow-sm ${msg.sender === "user"
                ? "bg-blue-500 text-white rounded-br-none"
                : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
                }`}
            >
              {msg.text}
            </div>
            {msg.sender === "user" && (
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center shadow-md ml-2">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white flex items-center gap-2">
        <button
          onClick={startMicStream}
          className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${micActive
            ? "bg-red-500 text-white animate-pulse"
            : "bg-green-600 text-white hover:bg-green-700"
            }`}
          title={micActive ? "Stop recording" : "Start recording"}
        >
          <Mic className="h-5 w-5" />
        </button>
        <input
          type="text"
          className="flex-1 h-12 border-2 border-gray-200 rounded-xl px-4 focus:outline-none"
          placeholder="Type your message..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
        />
        <button
          onClick={sendTextMessage}
          className="h-12 w-12 rounded-xl bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div >
  );
};

export default ChatPanel;