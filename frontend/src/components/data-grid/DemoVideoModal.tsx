import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";

interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  title?: string;
}

const DemoVideoModal: React.FC<DemoVideoModalProps> = ({
  isOpen,
  onClose,
  videoUrl = "https://www.youtube.com/embed/qqIVesU5McE?si=ZyVZQZ54loEyOWll",
  title = "DataKit Demo",
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-sm bg-black/60"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-6xl bg-black border border-white/10 rounded-lg shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5"/>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5 text-white/70" />
              </button>
            </div>

            {/* Video Container */}
            <div className="relative w-full aspect-video bg-black/50">
              <iframe
                src={videoUrl}
                title={title}
                className="absolute inset-0 w-full h-full rounded-b-lg"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DemoVideoModal;