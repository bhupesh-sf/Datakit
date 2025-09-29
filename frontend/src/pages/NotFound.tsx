import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";

const NotFound = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title={`${t('notFound.title')} - ${t('seo.title')}`}
        description={t('notFound.description')}
      />

      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white/20 mb-4">404</h1>
          <h2 className="text-2xl font-semibold mb-2">{t('notFound.title')}</h2>
          <p className="text-white/60 mb-6">{t('notFound.message')}</p>
          
          <Button  variant="ghost" onClick={() => navigate("/")}>
            {t('notFound.goHome')}
          </Button>
        </div>
      </div>
    </>
  );
};

export default NotFound;