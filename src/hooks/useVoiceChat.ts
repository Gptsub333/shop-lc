import { useState, useEffect, useCallback, useRef } from "react";

interface UseVoiceChatProps {
  onTranscriptUpdate?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  isChatboxOpen?: boolean;
}

export const useVoiceChat = ({
  onTranscriptUpdate,
  onFinalTranscript,
  isChatboxOpen = true,
}: UseVoiceChatProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const isManuallyStoppingRef = useRef(false);
  const isListeningRef = useRef(false);

  // 🔹 Initialize recognition once
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.warn("Speech recognition not supported");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const textPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += textPart + " ";
        else interimTranscript += textPart;
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);
      onTranscriptUpdate?.(currentTranscript);

      if (finalTranscript) {
        onFinalTranscript?.(finalTranscript.trim());
        setTranscript("");
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      isListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      // Restart only if chatbox open
      if (
        !isManuallyStoppingRef.current &&
        isListeningRef.current &&
        isChatboxOpen
      ) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;

    // Cleanup
    return () => {
      try {
        isManuallyStoppingRef.current = true;
        isListeningRef.current = false;
        recognition.stop();
        recognition.abort?.();
      } catch {}
    };
  }, [onTranscriptUpdate, onFinalTranscript, isChatboxOpen]);

  // ✅ Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current && isChatboxOpen) {
      try {
        isManuallyStoppingRef.current = false;
        isListeningRef.current = true;
        setIsListening(true);
        recognitionRef.current.start();
      } catch (error) {
        console.error("Error starting speech recognition:", error);
      }
    }
  }, [isChatboxOpen]);

  // ✅ Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        isManuallyStoppingRef.current = true;
        isListeningRef.current = false;
        setIsListening(false);
        setTranscript("");
        recognitionRef.current.stop();
        recognitionRef.current.abort?.();
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
      }
    }
  }, []);

  // ✅ Stop voice & speech output when chat closes
  useEffect(() => {
    if (!isChatboxOpen) {
      stopListening();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
  }, [isChatboxOpen, stopListening]);

  return { isListening, transcript, startListening, stopListening };
};
