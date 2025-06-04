import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export default function SaveDraftButton() {
  return (
    <div>
        <Button variant="outline" disabled className="flex items-center space-x-2">
            <Save className="w-4 h-4" />
            <span>下書き保存</span>
        </Button>
    </div>
  );
}   