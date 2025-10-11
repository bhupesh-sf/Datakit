import { motion } from "framer-motion";
import { Container, Terminal, Code, Hexagon, Upload, PlayCircle, FilePlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";

import S3 from "@/assets/s3.png";
import HuggingFace from "@/assets/huggingface.png";
import GoogleSheetsIcon from "@/components/icons/GoogleSheetsIcon";
import postgresIcon from "@/assets/postgres.png";

import { ImportProvider } from "@/types/remoteImport";
import { useFileUpload } from "@/components/data-grid/hooks";
import DemoVideoModal from "@/components/data-grid/DemoVideoModal";

interface RemoteImportOption {
  id: ImportProvider;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface Props {
  onImportOptionClick: (string: ImportProvider) => void;
}

const EmptyDataState: React.FC<Props> = ({ onImportOptionClick }) => {
  const { fileInputRef, handleButtonClick, handleFileSelect, isProcessing } = useFileUpload();
  const [showDemoModal, setShowDemoModal] = useState(false);
  const { t } = useTranslation();
  const { showAIAssistant } = useAppStore();

  const getUploadText = () => {
    if (isProcessing) return t('preview.empty.processing', 'Processing files...');
    return t('preview.empty.dropOrClick', 'Drop files here or click to browse');
  };

  const remoteOptions: RemoteImportOption[] = [
    {
      id: "postgresql",
      name: t('preview.providers.postgresql.name'),
      icon: <img src={postgresIcon} className="h-5 w-5" />,
      description: t('preview.providers.postgresql.description'),
    },
    {
      id: "s3",
      name: t('preview.providers.s3.name'),
      icon: <img src={S3} className="h-4 w-4" />,
      description: t('preview.providers.s3.description'),
    },
    {
      id: "huggingface",
      name: t('preview.providers.huggingface.name'),
      icon: <img src={HuggingFace} className="h-5 w-5" />,
      description: t('preview.providers.huggingface.description'),
    },
    {
      id: "google-sheets",
      name: t('preview.providers.googleSheets.name'),
      icon: <GoogleSheetsIcon className="h-5 w-5" />,
      description: t('preview.providers.googleSheets.description'),
    },
  ];

  const installOptions = [
    {
      name: t('preview.install.docker'),
      icon: Container,
      emoji: "🐳",
      url: "https://docs.datakit.page/docs/installation/docker",
    },
    {
      name: t('preview.install.homebrew'),
      icon: Terminal,
      emoji: "🍺",
      url: "https://docs.datakit.page/docs/installation/brew",
    },
    {
      name: t('preview.install.python'),
      icon: Code,
      emoji: "🐍",
      url: "https://docs.datakit.page/docs/installation/pip",
    },
    {
      name: t('preview.install.nodejs'),
      icon: Hexagon,
      emoji: "⬢",
      url: "https://docs.datakit.page/docs/installation/npm",
    },
  ];


  return (
    <div className="h-full flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-4xl"
      >
        {/* Main heading with demo button */}
        <div className="flex items-center justify-center gap-3 mb-3 flex-wrap">
          <h1 className="text-2xl font-heading font-semibold text-white">
            {t('preview.empty.title')}
          </h1>
          <span className="text-white/40 text-sm">{t('common.labels.or')}</span>
          <motion.button
            onClick={() => setShowDemoModal(true)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              boxShadow: "0 0 20px rgba(139, 92, 246, 0.35)"
            }}
            transition={{ delay: 0.2, duration: 0.3 }}
            whileHover={{ 
              scale: 1.05,
              boxShadow: "0 0 25px rgba(139, 92, 246, 0.4)"
            }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:text-white transition-all duration-300 group border border-white/20 hover:border-white/40"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              <PlayCircle className="h-4 w-4" />
            </motion.div>
            <span>{t('preview.empty.watchDemo')}</span>
          </motion.button>
        </div>

        {/* Description */}
        <p className="text-white/70 mb-4 leading-relaxed">
          {t('preview.empty.description')}
          <br />
          <motion.span
            className="relative overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <motion.span
              className="bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent bg-[length:200%_100%]"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {t('preview.empty.privacy')}
            </motion.span>
          </motion.span>{" "}
          {t('preview.empty.privacyNote')}
        </p>

        {/* Horizontal Import Flow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <div className={`grid gap-6 items-center ${
            showAIAssistant 
              ? 'grid-cols-1 gap-8' 
              : 'grid-cols-1 lg:grid-cols-4 lg:gap-0'
          }`}>
            
            {/* Primary Drop Zone - Left/Top */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className={showAIAssistant ? '' : 'lg:col-span-2'}
            >
              <motion.button
                onClick={handleButtonClick}
                disabled={isProcessing}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="group relative w-full border-2 border-dashed border-white/20 hover:border-primary/40 rounded-xl p-6 transition-all duration-300 hover:bg-white/[0.02] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                {/* Subtle gradient background on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative flex items-center gap-4">
                  {/* Floating upload icon */}
                  <motion.div
                    animate={{ 
                      y: [0, -2, 0],
                      scale: [1, 1.02, 1],
                      opacity: [0.6, 0.8, 0.6]
                    }}
                    transition={{ 
                      duration: 3, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                    className="flex-shrink-0"
                  >
                    <FilePlus className="h-6 w-6 text-white/60 group-hover:text-primary/80 transition-colors" />
                  </motion.div>
                  
                  <div className="flex-1 text-left">
                    {/* Dynamic text with gradient */}
                    <div className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent group-hover:from-primary group-hover:to-white transition-all duration-300 font-medium text-base whitespace-nowrap">
                      {getUploadText()}
                    </div>
                    
                    {/* Minimal file type indicators */}
                    <div className="flex gap-1 mt-2">
                      {['CSV', 'JSON', 'XLS', 'Parquet', 'TXT', 'DB'].map((type, i) => (
                        <motion.span
                          key={type}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + i * 0.05 }}
                          className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 group-hover:text-white/60 group-hover:border-white/20 transition-colors"
                        >
                          {type}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.button>
              
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.json,.xlsx,.xls,.parquet,.duckdb"
                onChange={handleFileSelect}
                disabled={isProcessing}
                multiple
              />
            </motion.div>

            {/* Divider */}
            {!showAIAssistant && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="hidden lg:flex flex-col items-center justify-center lg:-ml-12"
              >
                <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                <span className="text-white/40 text-sm mt-1 mb-1">{t('common.labels.or')}</span>
                <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              </motion.div>
            )}

            {/* Mobile/vertical divider */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className={showAIAssistant ? 'flex items-center justify-center py-4' : 'lg:hidden flex items-center justify-center py-4'}
            >
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <span className="text-white/40 text-sm mx-3">{t('common.labels.or')}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </motion.div>

            {/* Remote Options - Right/Bottom */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className={`flex flex-col items-center ${showAIAssistant ? '' : 'lg:-ml-20'}`}
            >
              <div className="text-sm text-white/60 mb-4 text-center whitespace-nowrap">
                {t('preview.empty.importFrom')}
              </div>
              
              {/* Original compact remote options */}
              <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-full p-1.5 gap-1">
                {remoteOptions.map((option, index) => (
                  <motion.button
                    key={option.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onImportOptionClick(option.id);
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + index * 0.1, duration: 0.3 }}
                    className="group relative w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                    type="button"
                  >
                    <div className="pointer-events-none">{option.icon}</div>

                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      <div className="font-medium">{option.name}</div>
                      <div className="text-white/70">{option.description}</div>
                      {/* Tooltip arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Self-hosting section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="border-t border-white/10 pt-6"
        >
          <div className="flex items-center justify-center gap-4">
            <p className="text-white/50 text-sm">{t('preview.empty.selfHost')}</p>
            
            <div className="flex items-center gap-3">
              {installOptions.map((option, index) => {
                const IconComponent = option.icon;

                return (
                  <motion.a
                    key={option.name}
                    href={option.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                    className="group relative w-10 h-10 rounded-full bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 flex items-center justify-center transition-all duration-200 hover:scale-105"
                  >
                    {/* Fallback to emoji on small screens or if icon fails */}
                    <span className="text-lg sm:hidden">{option.emoji}</span>
                    <IconComponent className="h-4 w-4 text-primary hidden sm:block" />
                    {/* Tooltip */}
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                      {option.name}
                    </div>
                  </motion.a>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
      
      {/* Demo Video Modal */}
      <DemoVideoModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        videoUrl="/video/datakit-demo.mp4"
        title={t('demo.title')}
      />
    </div>
  );
};

export default EmptyDataState;
