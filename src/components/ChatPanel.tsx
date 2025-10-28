// import { useState, useEffect, useRef } from "react";
// import { X, Send, Mic, MessageCircle, User, Bot, Camera } from "lucide-react";



// interface ChatPanelProps {
//   isOpen: boolean;
//   onClose: () => void;
// }

// interface Message {
//   id: string;
//   text: string;
//   sender: "user" | "assistant";
//   timestamp: number;
//   images?: { [key: string]: string }; // Optional: image URLs with names
//   virtualTryon?: {
//     studio_images: string[];
//     tryon_images: string[];
//   };
// }

// interface WebSocketMessage {
//   type: string;
//   data: {
//     message?: string;
//     session_id?: string;
//     audio?: string;
//     images?: { [key: string]: string };
//     status?: string;
//     studio_images?: string[];
//     tryon_images?: string[];
//     [key: string]: any;
//   };
// }

// const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [ws, setWs] = useState<WebSocket | null>(null);
//   const [isConnecting, setIsConnecting] = useState(false);
//   const [userInput, setUserInput] = useState("");
//   const [micActive, setMicActive] = useState(false);
//   // image capturing state
//   const [cameraOpen, setCameraOpen] = useState(false);
//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);

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




//   const BACKEND_WS_URL = 'wss://shoplc.holbox.ai';
//   // const BACKEND_WS_URL = 'ws://34.228.228.93:5000';

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

//             if (data.type === 'audio') {
//               playDeepgramAudio(data.data);
//             }
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
//         console.log("🗣️ Transcription received:", data.data.message);
//         break;
//       case "ai_response":
//         appendMessage("assistant", data.data.message || "");
//         break;
//       case "image_list":
//         appendImageMessage(data.data.images || {});
//         console.log("🖼️ Image list received:", data.data.images);
//         break;
//       case "virtual_tryon":
//         appendVirtualTryonMessage(
//           data.data.studio_images || [],
//           data.data.tryon_images || []
//         );
//         console.log("👔 Virtual try-on received");
//         break;
//       case "audio_chunk":
//         // Don't play audio here - it's already being played through /client-audio socket
//         console.log("📻 Audio chunk received (skipping - using direct audio stream)");
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

//   const appendImageMessage = (images: { [key: string]: string }) => {
//     const newMsg: Message = {
//       id: `assistant-${Date.now()}-${Math.random()}`,
//       text: "Here are some products I found:",
//       sender: "assistant",
//       timestamp: Date.now(),
//       images: images
//     };
//     setMessages((prev) => [...prev, newMsg]);
//   };

//   const appendVirtualTryonMessage = (studioImages: string[], tryonImages: string[]) => {
//     const newMsg: Message = {
//       id: `assistant-${Date.now()}-${Math.random()}`,
//       text: "Here's your virtual try-on result:",
//       sender: "assistant",
//       timestamp: Date.now(),
//       virtualTryon: {
//         studio_images: studioImages,
//         tryon_images: tryonImages
//       }
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


//   //------------------------------------------------------------
//   //Camera Functionality
//   //------------------------------------------------------------
//   const startCamera = async () => {
//     try {
//       setCameraOpen(true);

//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { facingMode: "user" } // mobile: switch to "environment" for rear camera
//       });

//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//         videoRef.current.play();
//       }
//     } catch (err) {
//       console.error("Camera access error:", err);
//       alert("Unable to access camera. Check permissions.");
//     }
//   };

//   const capturePhoto = () => {
//     if (!videoRef.current || !canvasRef.current) return;

//     const width = videoRef.current.videoWidth;
//     const height = videoRef.current.videoHeight;

//     canvasRef.current.width = width;
//     canvasRef.current.height = height;

//     const ctx = canvasRef.current.getContext("2d");
//     if (!ctx) return;

//     ctx.drawImage(videoRef.current, 0, 0, width, height);
//     const base64Image = canvasRef.current.toDataURL("image/jpeg");

//     // Display in UI
//     appendMessage("user", "📸 Image sent!");

//     setMessages(prev => [
//       ...prev,
//       {
//         id: `user-img-${Date.now()}`,
//         text: "",
//         sender: "user",
//         timestamp: Date.now(),
//         images: {
//           captured: base64Image
//         }
//       }
//     ]);

//     // Send to backend
//     wsRef.current?.send(JSON.stringify({
//       type: "send_image",
//       data: { image: base64Image }
//     }));

//     closeCamera();
//   };

//   const closeCamera = () => {
//     setCameraOpen(false);

//     const stream = videoRef.current?.srcObject as MediaStream;
//     if (stream) {
//       stream.getTracks().forEach(track => track.stop());
//     }
//   };


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
//                 ? micActive
//                   ? "🎤 Listening..."
//                   : "Connected"
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
//               className={`max-w-[75%] rounded-2xl shadow-sm ${msg.sender === "user"
//                 ? "bg-blue-500 text-white rounded-br-none"
//                 : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
//                 }`}
//             >
//               <div className="p-3">{msg.text}</div>

//               {/* Display images if present */}
// {msg.images && Object.keys(msg.images).length > 0 && (
//   <div className="px-3 pb-3 space-y-2">
//     {Object.entries(msg.images).map(([imagePath, imageName], index) => {
//       // Extract just the filename from the full path
//       const filename = imagePath.split('/').pop() || imagePath;
//       // Construct the image URL (adjust this based on your backend setup)
//       // const imageUrl = `${BACKEND_WS_URL.replace('wss://', 'https://').replace('ws://', 'http://')}/products/${filename}`;
//       const imageUrl = `https://shoplc.holbox.ai/api/images/${filename}`;

//       return (
//         <div
//           key={index}
//           className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
//         >
//           <img
//             src={imageUrl}
//             alt={imageName}
//             className="w-full h-48 object-cover"
//             onError={(e) => {
//               // Fallback if image fails to load
//               e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">No Image</text></svg>';
//             }}
//           />
//           <div className="p-2">
//             <p className="text-sm font-medium text-gray-800">{imageName}</p>
//           </div>
//         </div>
//       );
//     })}
//   </div>
// )}

//               {/* Display virtual try-on results */}
//               {msg.virtualTryon && (
//                 <div className="px-3 pb-3 space-y-3">
//                   {msg.virtualTryon.studio_images.map((studioPath, index) => {
//                     const studioFilename = studioPath.split('/').pop() || studioPath;
//                     const tryonFilename = msg.virtualTryon!.tryon_images[index]?.split('/').pop() || '';

//                     // Construct image URLs
//                     // const studioUrl = `${BACKEND_WS_URL.replace('wss://', 'https://').replace('ws://', 'http://')}/virtual_tryon/${studioFilename}`;
//                     // const tryonUrl = `${BACKEND_WS_URL.replace('wss://', 'https://').replace('ws://', 'http://')}/virtual_tryon/${tryonFilename}`;


//                     const studioUrl = `https://shoplc.holbox.ai/api/virtualtryon/${studioFilename}`;
//                     const tryonUrl = `https://shoplc.holbox.ai/api/virtualtryon/${tryonFilename}`;

//                     console.log("Studio URL:", studioUrl);
//                     console.log("Try-on URL:", tryonUrl);

//                     return (
//                       <div key={index} className="space-y-2">
//                         <div className="grid grid-cols-2 gap-2">
//                           {/* Studio/Original Image */}
//                           <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
//                             <img
//                               src={studioUrl}
//                               alt="Studio"
//                               className="w-full h-48 object-cover"
//                               onError={(e) => {
//                                 e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">Studio</text></svg>';
//                               }}
//                             />
//                             <div className="p-2 bg-blue-50">
//                               <p className="text-xs font-semibold text-blue-800 text-center">Original</p>
//                             </div>
//                           </div>

//                           {/* Try-on Image */}
//                           <div className="bg-gray-50 rounded-lg overflow-hidden border border-green-200">
//                             <img
//                               src={tryonUrl}
//                               alt="Virtual Try-on"
//                               className="w-full h-48 object-cover"
//                               onError={(e) => {
//                                 e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">Try-on</text></svg>';
//                               }}
//                             />
//                             <div className="p-2 bg-green-50">
//                               <p className="text-xs font-semibold text-green-800 text-center">Virtual Try-on</p>
//                             </div>
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
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
//       <div className="p-4 border-t bg-white flex items-center justify-center gap-2">

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
//         <button
//           onClick={startCamera}
//           className="h-12 w-12 rounded-xl flex bg-green-600 items-center justify-center text-white hover:bg-green-700"
//           title="Open Camera"
//         >
//           <Camera className="h-5 w-5" />
//         </button>

//         {/* <input
//           type="text"
//           className="flex-1 h-12 border-2 border-gray-200 rounded-xl px-4 focus:outline-none"
//           placeholder="Type your message..."
//           value={userInput}
//           onChange={(e) => setUserInput(e.target.value)}
//         // onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
//         /> */ }
//         {/* <button
//           // onClick={sendTextMessage}
//           className="h-12 w-12 rounded-xl bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
//         >
//           <Send className="h-5 w-5" />
//         </button> */}
//         {cameraOpen && (
//           <div className="absolute inset-0 bg-black/70 z-50 flex flex-col items-center justify-center">
//             <video ref={videoRef} className="w-full max-w-sm rounded-lg shadow-lg" />

//             <div className="flex gap-4 mt-4">
//               <button
//                 onClick={capturePhoto}
//                 className="px-6 py-3 bg-blue-500 rounded-lg text-white font-semibold"
//               >
//                 Capture
//               </button>
//               <button
//                 onClick={closeCamera}
//                 className="px-6 py-3 bg-gray-500 rounded-lg text-white font-semibold"
//               >
//                 Cancel
//               </button>
//             </div>

//             <canvas ref={canvasRef} hidden />
//           </div>
//         )}

//       </div>
//     </div>
//   );
// };

// export default ChatPanel;


import { useState, useEffect, useRef } from "react";
import { X, Send, Mic, MessageCircle, User, Bot, Camera } from "lucide-react";
import { Upload } from "lucide-react";



interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: number;
  images?: { [key: string]: string }; // Optional: image URLs with names
  virtualTryon?: {
    studio_images: string[];
    tryon_images: string[];
  };
}

interface WebSocketMessage {
  type: string;
  data: {
    message?: string;
    session_id?: string;
    audio?: string;
    images?: { [key: string]: string };
    status?: string;
    studio_images?: string[];
    tryon_images?: string[];
    [key: string]: any;
  };
}

const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  // image capturing state
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const micSocket = useRef<WebSocket | null>(null);
  const imageSocket = useRef<WebSocket | null>(null);
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



  // const imageUrl = `https://shoplc.holbox.ai/api/images/${filename}`;

  const BACKEND_WS_URL = 'wss://shoplc.holbox.ai';
  // const BACKEND_WS_URL = 'ws://34.228.228.93:5000';

  // ------------------------------------------------------------
  // Helper function to convert file path to URL
  // ------------------------------------------------------------
  const convertFilePathToUrl = (filePath: string): string => {
    // Extract the path after 'products/'
    // Example: /home/ubuntu/shoplc_voice/products/user_images/session-140680801025248.jpg
    // Should become: https://shoplc.holbox.ai/api/images/user_images/session-140680801025248.jpg

    const productsIndex = filePath.indexOf('products/');
    if (productsIndex !== -1) {
      // Extract everything after 'products/'
      const pathAfterProducts = filePath.substring(productsIndex + 'products/'.length);
      return `https://shoplc.holbox.ai/api/images/${pathAfterProducts}`;
    }

    // Fallback: if 'products/' not found, try to extract just the filename
    const filename = filePath.split('/').pop() || filePath;
    return `https://shoplc.holbox.ai/api/images/${filename}`;
  };

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
      case "image_list":
        appendImageMessage(data.data.images || {});
        console.log("🖼️ Image list received:", data.data.images);
        break;
      case "virtual_tryon":
        appendVirtualTryonMessage(
          data.data.studio_images || [],
          data.data.tryon_images || []
        );
        console.log("👔 Virtual try-on received");
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

  const appendImageMessage = (images: { [key: string]: string }) => {
    const newMsg: Message = {
      id: `assistant-${Date.now()}-${Math.random()}`,
      text: "Here are some products I found:",
      sender: "assistant",
      timestamp: Date.now(),
      images: images
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const appendImageMessageForUserPic = (images: { [key: string]: string }) => {
    const newMsg: Message = {
      id: `user-${Date.now()}-${Math.random()}`,
      text: "Uploaded Image: ",
      sender: "user",
      timestamp: Date.now(),
      images: images
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const appendVirtualTryonMessage = (studioImages: string[], tryonImages: string[]) => {
    const newMsg: Message = {
      id: `assistant-${Date.now()}-${Math.random()}`,
      text: "Here's your virtual try-on result:",
      sender: "assistant",
      timestamp: Date.now(),
      virtualTryon: {
        studio_images: studioImages,
        tryon_images: tryonImages
      }
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

      // Close image socket if open
      if (imageSocket.current) {
        imageSocket.current.close();
        imageSocket.current = null;
      }

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


  //------------------------------------------------------------
  //Camera Functionality + Image Upload via WebSocket
  //------------------------------------------------------------


  // Send pre-recorded audio to backend via /client-audio
  const sendAudioToBackend = async (audioPath: string) => {
    try {
      console.log("📤 Starting audio send to backend:", audioPath);

      // Fetch the audio file from assets
      const response = await fetch(audioPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      console.log(`📦 Audio file loaded: ${arrayBuffer.byteLength} bytes`);

      // Create audio context with standard sample rate for decoding
      const audioContext = new AudioContext();

      let audioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log(`🎵 Audio decoded: ${audioBuffer.sampleRate}Hz, ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channel(s)`);
      } catch (decodeError) {
        console.error("❌ Failed to decode audio:", decodeError);
        await audioContext.close();
        throw new Error("Failed to decode audio file. Please ensure the file is a valid audio format (MP3, WAV, etc.)");
      }

      // Get audio data as Float32Array (use first channel if stereo)
      const channelData = audioBuffer.getChannelData(0);
      console.log(`📊 Channel data length: ${channelData.length} samples`);

      // Resample to 8kHz if needed
      const targetSampleRate = 8000;
      let resampledData: Float32Array;

      if (audioBuffer.sampleRate !== targetSampleRate) {
        console.log(`🔄 Resampling from ${audioBuffer.sampleRate}Hz to ${targetSampleRate}Hz...`);
        resampledData = resampleAudio(channelData, audioBuffer.sampleRate, targetSampleRate);
        console.log(`✅ Resampled to ${resampledData.length} samples`);
      } else {
        resampledData = channelData;
        console.log(`✅ Already at ${targetSampleRate}Hz, no resampling needed`);
      }

      // Convert Float32 to PCM16 and then to μ-law
      const muLawData = new Uint8Array(resampledData.length);
      for (let i = 0; i < resampledData.length; i++) {
        // Convert float32 (-1.0 to 1.0) to PCM16 (-32768 to 32767)
        const pcm16 = Math.max(-32768, Math.min(32767, Math.round(resampledData[i] * 32767)));
        // Encode to μ-law
        muLawData[i] = encodeMuLaw(pcm16);
      }
      console.log(`🔐 Encoded to μ-law: ${muLawData.length} bytes`);

      // Check if WebSocket is open or create new connection
      if (!micSocket.current || micSocket.current.readyState !== WebSocket.OPEN) {
        console.log("🔌 Opening new audio WebSocket connection...");

        const audioSocketUrl = `${BACKEND_WS_URL}/client-audio`;
        const socket = new WebSocket(audioSocketUrl);
        micSocket.current = socket;

        // Wait for socket to open
        await new Promise<void>((resolve, reject) => {
          socket.onopen = () => {
            console.log("✅ Audio WebSocket connected");
            resolve();
          };
          socket.onerror = (error) => {
            console.error("❌ WebSocket connection error:", error);
            reject(new Error("Failed to connect to audio WebSocket"));
          };
          // Timeout after 5 seconds
          setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
        });
      }

      // Send through client-audio WebSocket in chunks
      const chunkSize = 4096; // 4KB chunks
      const totalChunks = Math.ceil(muLawData.length / chunkSize);
      console.log(`📤 Sending audio in ${totalChunks} chunks...`);

      for (let i = 0; i < muLawData.length; i += chunkSize) {
        const chunk = muLawData.slice(i, Math.min(i + chunkSize, muLawData.length));

        if (micSocket.current && micSocket.current.readyState === WebSocket.OPEN) {
          micSocket.current.send(chunk.buffer);
          const chunkNum = Math.floor(i / chunkSize) + 1;
          console.log(`📦 Sent chunk ${chunkNum}/${totalChunks} (${chunk.length} bytes)`);
        } else {
          throw new Error("WebSocket closed during transmission");
        }

        // Small delay between chunks to avoid overwhelming the connection
        await new Promise(resolve => setTimeout(resolve, 40));
      }

      console.log("✅ Audio sent successfully to backend via /client-audio");
      console.log(`📊 Total sent: ${muLawData.length} bytes at 8000Hz μ-law`);

      await audioContext.close();
    } catch (err) {
      console.error("❌ Error sending audio to backend:", err);
      if (err instanceof Error) {
        console.error("Error details:", err.message);
      }
      throw err;
    }
  };

  // Helper function to resample audio
  const resampleAudio = (audioData: Float32Array, fromRate: number, toRate: number): Float32Array => {
    if (fromRate === toRate) return audioData;

    const ratio = fromRate / toRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexInt = Math.floor(srcIndex);
      const fraction = srcIndex - srcIndexInt;

      if (srcIndexInt + 1 < audioData.length) {
        // Linear interpolation
        result[i] = audioData[srcIndexInt] * (1 - fraction) + audioData[srcIndexInt + 1] * fraction;
      } else {
        result[i] = audioData[srcIndexInt];
      }
    }

    return result;
  };

  // Send notification via frontend-updates
  const sendNotificationViaFrontendUpdates = (message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "audio_notification",
          data: { message: message }
        })
      );
      console.log("📤 Notification sent via /frontend-updates");
    } else {
      console.warn("⚠️ Frontend updates socket not open");
    }
  };

  // Send image to backend via /client-image WebSocket
  const sendImageToBackend = async (base64Image: string, tempMessageId: string) => {
    try {
      // Remove the data:image/jpeg;base64, prefix to get pure base64
      const base64Data = base64Image.split(',')[1];

      // Connect to /client-image endpoint
      const imageSocketUrl = `${BACKEND_WS_URL}/client-image`;
      console.log("📸 Connecting to image endpoint:", imageSocketUrl);

      const socket = new WebSocket(imageSocketUrl);
      imageSocket.current = socket;

      socket.onopen = () => {
        console.log("📸 Image socket connected!");

        // Send base64 image data (as string, not JSON)
        socket.send(base64Data);
      };

      socket.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          console.log("📸 Image upload response:", response);

          if (response.success && response.image) {

            appendImageMessageForUserPic(response.image || {})
            console.log("✅ Image uploaded successfully:", response.image);

            // // Convert the file path to URL
            // const imageUrl = convertFilePathToUrl(response.file_path);
            // console.log("🔗 Converted URL:", imageUrl);

            // // Update the temporary message with the actual image URL
            // setMessages(prev => prev.map(msg => {
            //   if (msg.id === tempMessageId) {
            //     return {
            //       ...msg,
            //       text: "📸 Image uploaded",
            //       images: {
            //         uploaded: imageUrl
            //       }
            //     };
            //   }
            //   return msg;
            // }));

            // Send audio notification to backend via /client-audio
            // This sends the pre-recorded message as μ-law encoded audio at 8000Hz
            sendAudioToBackend('/assets/image-uploaded.mp3').catch(err => {
              console.error("Failed to send audio notification:", err);
              // Fallback to local playback if backend sending fails

            });

            // Optional: Also play locally for immediate feedback (uncomment if desired)
            // playAudioNotification('/assets/image-uploaded.mp3');

            // Optional: Send text notification via /frontend-updates (uncomment if needed)
            // sendNotificationViaFrontendUpdates("I have uploaded an image");

            appendMessage("assistant", "Image received successfully! Processing...");
          } else {
            console.error("❌ Image upload failed:", response.error);

            // Update the temporary message to show error
            setMessages(prev => prev.map(msg => {
              if (msg.id === tempMessageId) {
                return {
                  ...msg,
                  text: "❌ Failed to upload image"
                };
              }
              return msg;
            }));

            appendMessage("assistant", `Failed to process image: ${response.message || 'Unknown error'}`);
          }

          // Close socket after receiving response
          socket.close();
          imageSocket.current = null;
        } catch (err) {
          console.error("❌ Error parsing image response:", err);

          // Update the temporary message to show error
          setMessages(prev => prev.map(msg => {
            if (msg.id === tempMessageId) {
              return {
                ...msg,
                text: "❌ Error processing response"
              };
            }
            return msg;
          }));

          appendMessage("assistant", "Error processing server response.");
        }
      };

      socket.onerror = (err) => {
        console.error("📸 Image socket error:", err);

        // Update the temporary message to show error
        setMessages(prev => prev.map(msg => {
          if (msg.id === tempMessageId) {
            return {
              ...msg,
              text: "❌ Failed to send image"
            };
          }
          return msg;
        }));

        appendMessage("assistant", "Failed to send image. Please try again.");
        socket.close();
        imageSocket.current = null;
      };

      socket.onclose = () => {
        console.log("📸 Image socket closed");
        imageSocket.current = null;
      };

    } catch (err) {
      console.error("❌ Error sending image:", err);

      // Update the temporary message to show error
      setMessages(prev => prev.map(msg => {
        if (msg.id === tempMessageId) {
          return {
            ...msg,
            text: "❌ Error processing image"
          };
        }
        return msg;
      }));

      appendMessage("assistant", "Error processing image. Please try again.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tempMessageId = `user-upload-${Date.now()}-${Math.random()}`;

    // Temporary message while uploading
    setMessages(prev => [
      ...prev,
      {
        id: tempMessageId,
        text: `📤 Uploading ${file.name}...`,
        sender: "user",
        timestamp: Date.now(),
      },
    ]);

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Image = reader.result as string;
        sendImageToBackend(base64Image, tempMessageId);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("❌ File upload error:", err);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessageId
            ? { ...msg, text: "❌ Failed to read file" }
            : msg
        )
      );
    }

    // Allow same file to be selected again
    e.target.value = "";
  };

  const startCamera = async () => {
    try {
      setCameraOpen(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" } // mobile: switch to "environment" for rear camera
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Unable to access camera. Check permissions.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const width = videoRef.current.videoWidth;
    const height = videoRef.current.videoHeight;

    canvasRef.current.width = width;
    canvasRef.current.height = height;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, width, height);
    const base64Image = canvasRef.current.toDataURL("image/jpeg");

    // Create a temporary message ID
    const tempMessageId = `user-img-${Date.now()}-${Math.random()}`;

    // Display a temporary "uploading" message
    setMessages(prev => [
      ...prev,
      {
        id: tempMessageId,
        text: "📤 Uploading image...",
        sender: "user",
        timestamp: Date.now()
      }
    ]);

    // Send to backend via /client-image WebSocket
    // The image will be displayed once we receive the URL from the backend
    sendImageToBackend(base64Image, tempMessageId);

    closeCamera();
  };

  const closeCamera = () => {
    setCameraOpen(false);

    const stream = videoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };


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
              className={`max-w-[75%] rounded-2xl shadow-sm ${msg.sender === "user"
                ? "bg-blue-500 text-white rounded-br-none"
                : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
                }`}
            >
              <div className="p-3">{msg.text}</div>

              {/* Display images if present */}


              {/* {msg.images && Object.keys(msg.images).length > 0 && (
                <div className="px-3 pb-3 space-y-2">
                  {Object.entries(msg.images).map(([key, imagePathOrUrl], index) => {
                    // Determine if it's already a URL or needs conversion
                    let imageUrl: string;

                    if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
                      // Already a URL
                      imageUrl = imagePathOrUrl;
                    } else if (imagePathOrUrl.startsWith('data:image')) {
                      // Base64 image (shouldn't happen with new logic, but kept as fallback)
                      imageUrl = imagePathOrUrl;
                    } else {
                      // File path - convert to URL
                      imageUrl = convertFilePathToUrl(imagePathOrUrl);
                    }

                    // Extract a display name
                    const displayName = key === 'uploaded' ? 'Uploaded Image' :
                      key === 'captured' ? 'Captured Image' :
                        imagePathOrUrl.split('/').pop() || key;

                    return (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <img
                          src={imageUrl}
                          alt={displayName}
                          className="w-full h-48 object-cover"
                          onError={(e) => {
                            // Fallback if image fails to load
                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">No Image</text></svg>';
                          }}
                        />
                        <div className="p-2">
                          <p className="text-sm font-medium text-gray-800">{displayName}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )} */}

              {msg.images && Object.keys(msg.images).length > 0 && (
                <div className="px-3 pb-3 space-y-2">
                  {Object.entries(msg.images).map(([imagePath, imageName], index) => {
                    // Extract just the filename from the full path
                    // const filename = imagePath.split('/').pop() || imagePath;
                    const filename = imagePath.split("products/")[1];
                    // Construct the image URL (adjust this based on your backend setup)
                    // const imageUrl = `${BACKEND_WS_URL.replace('wss://', 'https://').replace('ws://', 'http://')}/products/${filename}`;
                    console.log("Image filename:", filename);
                    const imageUrl = `https://shoplc.holbox.ai/api/images/${filename}`;
                    console.log("Constructed image URL:", imageUrl);

                    return (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <img
                          src={imageUrl}
                          alt={imageName}
                          className="w-full h-48 object-cover"
                          onError={(e) => {
                            // Fallback if image fails to load
                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">No Image</text></svg>';
                          }}
                        />
                        <div className="p-2">
                          <p className="text-sm font-medium text-gray-800">{imageName}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Display virtual try-on results */}
              {msg.virtualTryon && (
                <div className="px-3 pb-3 space-y-3">
                  {msg.virtualTryon.studio_images.map((studioPath, index) => {
                    const studioFilename = studioPath.split('/').pop() || studioPath;
                    const tryonFilename = msg.virtualTryon!.tryon_images[index]?.split('/').pop() || '';

                    // Construct image URLs
                    const studioUrl = `https://shoplc.holbox.ai/api/virtualtryon/${studioFilename}`;
                    const tryonUrl = `https://shoplc.holbox.ai/api/virtualtryon/${tryonFilename}`;

                    console.log("Studio URL:", studioUrl);
                    console.log("Try-on URL:", tryonUrl);

                    return (
                      <div key={index} className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {/* Studio/Original Image */}
                          <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                            <img
                              src={studioUrl}
                              alt="Studio"
                              className="w-full h-48 object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">Studio</text></svg>';
                              }}
                            />
                            <div className="p-2 bg-blue-50">
                              <p className="text-xs font-semibold text-blue-800 text-center">Original</p>
                            </div>
                          </div>

                          {/* Try-on Image */}
                          <div className="bg-gray-50 rounded-lg overflow-hidden border border-green-200">
                            <img
                              src={tryonUrl}
                              alt="Virtual Try-on"
                              className="w-full h-48 object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">Try-on</text></svg>';
                              }}
                            />
                            <div className="p-2 bg-green-50">
                              <p className="text-xs font-semibold text-green-800 text-center">Virtual Try-on</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
      <div className="p-4 border-t bg-white flex items-center justify-center gap-2">
        {/* Mic Button */}
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

        {/* Camera Button */}
        <button
          onClick={startCamera}
          className="h-12 w-12 rounded-xl flex bg-green-600 items-center justify-center text-white hover:bg-green-700"
          title="Open Camera"
        >
          <Camera className="h-5 w-5" />
        </button>

        {/* Upload Button */}
        <label
          htmlFor="fileUpload"
          className="h-12 w-12 rounded-xl flex bg-green-600 items-center justify-center text-white hover:bg-green-700 cursor-pointer"
          title="Upload Image"
        >
          <Upload className="h-5 w-5" />
        </label>
        <input
          type="file"
          accept="image/*"
          id="fileUpload"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Camera Overlay */}
        {cameraOpen && (
          <div className="absolute inset-0 bg-black/70 z-50 flex flex-col items-center justify-center">
            <video ref={videoRef} className="w-full max-w-sm rounded-lg shadow-lg" />

            <div className="flex gap-4 mt-4">
              <button
                onClick={capturePhoto}
                className="px-6 py-3 bg-blue-500 rounded-lg text-white font-semibold"
              >
                Capture
              </button>
              <button
                onClick={closeCamera}
                className="px-6 py-3 bg-gray-500 rounded-lg text-white font-semibold"
              >
                Cancel
              </button>
            </div>

            <canvas ref={canvasRef} hidden />
          </div>
        )}
      </div>

    </div>
  );
};

export default ChatPanel;
