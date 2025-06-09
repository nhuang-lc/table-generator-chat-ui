import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isComplexValue } from './thread/messages/generic-interrupt';

interface InterruptDialogProps {
  onApprove: () => void;
  onFeedback: (feedback: string) => void;
  interrupt?: Record<string, unknown>;
}

export function InterruptDialog({ onApprove, onFeedback, interrupt }: InterruptDialogProps) {
  const [feedback, setFeedback] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[600px] space-y-4">
        <h2 className="text-lg font-semibold">Action Required</h2>
        
        {interrupt && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md overflow-auto max-h-[400px]">
            {isComplexValue(interrupt) ? (
                <code className="rounded bg-gray-50 px-2 py-1 font-mono text-sm whitespace-pre-wrap">
                    {JSON.stringify(interrupt, null, 2)}
                </code>
                ) : (
                <span className="whitespace-pre-wrap">{String(interrupt)}</span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Button 
            onClick={onApprove}
            className="w-full"
            variant="default"
          >
            Approve
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Enter feedback..."
              className="flex-1"
            />
            <Button 
              onClick={() => onFeedback(feedback)}
              variant="outline"
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 