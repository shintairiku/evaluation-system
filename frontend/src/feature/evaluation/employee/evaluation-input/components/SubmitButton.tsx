import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export default function SubmitButton() {
  return (
    <div>
      <Button variant="outline" disabled className="flex items-center space-x-2">
        <Send className="w-4 h-4" />
        <span>最終提出</span>
      </Button>
    </div>
  );
}