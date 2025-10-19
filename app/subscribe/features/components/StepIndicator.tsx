'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: number;
  steps: {
    number: number;
    title: string;
    description?: string;
  }[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="w-full py-8">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted" style={{ zIndex: 0 }}>
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
            }}
          />
        </div>

        {/* Steps */}
  {steps.map((step) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          
          return (
            <div
              key={step.number}
              className="flex flex-col items-center relative"
              style={{ zIndex: 1 }}
            >
              {/* Step Circle */}
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 bg-background transition-all duration-300',
                  {
                    'border-primary bg-primary text-primary-foreground': isCurrent || isCompleted,
                    'border-muted-foreground/30': !isCurrent && !isCompleted,
                  }
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{step.number}</span>
                )}
              </div>

              {/* Step Label */}
              <div className="mt-2 text-center hidden sm:block">
                <p
                  className={cn('text-sm font-medium', {
                    'text-primary': isCurrent || isCompleted,
                    'text-muted-foreground': !isCurrent && !isCompleted,
                  })}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Step Label */}
      <div className="sm:hidden text-center mt-4">
        <p className="text-sm font-medium text-primary">
          {steps.find((s) => s.number === currentStep)?.title}
        </p>
        {steps.find((s) => s.number === currentStep)?.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {steps.find((s) => s.number === currentStep)?.description}
          </p>
        )}
      </div>
    </div>
  );
}
