import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceChatButtonProps {
  onClick: () => void;
}

const VoiceChatButton = ({ onClick }: VoiceChatButtonProps) => {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-lg hover:scale-110 transition-transform bg-[#15803d] hover:bg-[#15803d]"
    >
      <Mic className="h-6 w-6" />
    </Button>
  );
};

export default VoiceChatButton;
