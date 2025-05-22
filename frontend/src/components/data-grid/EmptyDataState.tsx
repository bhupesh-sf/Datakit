import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const EmptyDataState = () => {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-lg"
      >
        {/* Main heading */}
        <h1 className="text-2xl font-heading font-semibold text-white mb-3">
          No data to preview
        </h1>

        {/* Description */}
        <p className="text-white/70 mb-6 leading-relaxed">
          Import your files from the sidebar to start analyzing your data.
          <br />
          <span className="text-primary">Your data stays private</span> —
          everything runs locally in your browser.
        </p>

        {/* Import instruction */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center justify-center text-primary text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span>Use the import options in the sidebar</span>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default EmptyDataState;
