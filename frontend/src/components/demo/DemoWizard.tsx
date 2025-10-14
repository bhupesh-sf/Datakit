import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  Database, 
  Brain, 
  BarChart3,
  Play,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import demoImage from '@/assets/demo.png';
import demo2Image from '@/assets/demo2.png';
import demo3Image from '@/assets/demo3.png';
import demo4Image from '@/assets/demo4.png';
import intro from '@/assets/intro.png';

interface DemoWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGetStarted?: () => void;
}

interface DemoStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  images: string[];
  highlights: string[];
  ctaText: string;
}

const DemoWizard: React.FC<DemoWizardProps> = ({ 
  isOpen, 
  onClose, 
  onGetStarted 
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  const steps: DemoStep[] = [
    {
      id: 'welcome',
      title: t('demoWizard.steps.welcome.title'),
      description: t('demoWizard.steps.welcome.description'),
      icon: Upload,
      images: [intro],
      highlights: [],
      ctaText: t('demoWizard.steps.welcome.ctaText')
    },
    {
      id: 'preview',
      title: t('demoWizard.steps.preview.title'),
      description: t('demoWizard.steps.preview.description'),
      icon: BarChart3,
      images: [demoImage],
      highlights: [],
      ctaText: t('demoWizard.steps.preview.ctaText')
    },
    {
      id: 'sql',
      title: t('demoWizard.steps.sql.title'),
      description: t('demoWizard.steps.sql.description'),
      icon: BarChart3,
      images: [demo2Image],
      highlights: [],
      ctaText: t('demoWizard.steps.sql.ctaText')
    },
    {
      id: 'notebooks',
      title: t('demoWizard.steps.notebooks.title'),
      description: t('demoWizard.steps.notebooks.description'),
      icon: Database,
      images: [demo3Image],
      highlights: [],
      ctaText: t('demoWizard.steps.notebooks.ctaText')
    },
    {
      id: 'remote-sources',
      title: t('demoWizard.steps.remoteSources.title'),
      description: t('demoWizard.steps.remoteSources.description'),
      icon: Brain,
      images: [demo4Image],
      highlights: [],
      ctaText: t('demoWizard.steps.remoteSources.ctaText')
    }
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      // On last step, mark as seen and close wizard
      localStorage.setItem('datakit-welcome-seen', 'true');
      onGetStarted?.();
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, isLastStep, onGetStarted, onClose]);

  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  const handleStepClick = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
  }, []);


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ 
              duration: 0.6, 
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              damping: 20,
              stiffness: 300
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl mx-4 overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Main Content */}
            <div className="relative">
              {/* Large Image */}
              <div className="relative">
                <img 
                  src={currentStepData.images[0]} 
                  alt="DataKit interface showing data analysis capabilities"
                  className="w-full h-auto rounded-2xl"
                />
                
                {/* Text Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/98 via-black/90 via-black/70 to-black/30 p-8 rounded-b-2xl">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="max-w-2xl"
                  >
                    <div className="mb-6">
                      <h1 className="text-4xl font-bold text-white mb-3">
                        {currentStepData.title}
                      </h1>
                      <p className="text-white/90 text-xl leading-relaxed">
                        {currentStepData.description}
                      </p>
                    </div>


                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                      {/* Step indicators */}
                      <div className="flex items-center gap-3">
                        {steps.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => handleStepClick(index)}
                            className={`w-4 h-4 rounded-full transition-all ${
                              index === currentStep
                                ? 'bg-primary scale-125'
                                : 'bg-white/40 hover:bg-white/60'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-4">
                        {!isFirstStep && (
                          <Button
                            onClick={handlePrevious}
                            variant="outline"
                            className="flex items-center gap-2 border-white/30 hover:border-white/50 text-white bg-black/20 backdrop-blur-sm px-6 py-3"
                          >
                            <ChevronLeft className="w-5 h-5" />
                            {t('demoWizard.buttons.previous')}
                          </Button>
                        )}
                        <Button
                          onClick={handleNext}
                          className="bg-primary hover:bg-primary text-white flex items-center gap-2 px-8 py-3 text-lg font-semibold"
                        >
                          {isLastStep ? t('demoWizard.buttons.getStarted') : t('demoWizard.buttons.next')}
                          {isLastStep ? (
                            <Play className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DemoWizard;