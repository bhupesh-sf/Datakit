import { SEO } from "@/components/common/SEO";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Privacy = () => {
  const { t } = useTranslation();
  
  return (
    <>
      <SEO 
        title={`${t('privacy.title')} - ${t('seo.title')}`}
        description={t('privacy.description')}
      />
      
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-3xl mx-auto">
          {/* Back button */}
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
{t('privacy.backToDatakit')}
          </Link>
          
          <h1 className="text-2xl font-bold mb-8">{t('privacy.title')}</h1>
          
          <div className="space-y-6 text-white/80 leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('pages.privacy.dataStaysLocal.title', { defaultValue: 'Your Data Stays Local' })}</h2>
              <p className="mb-4">
                {t('pages.privacy.dataStaysLocal.description', { defaultValue: 'DataKit processes all your files locally in your browser. Your data never leaves your device. We don\'t upload, store, or have access to any of your files or their contents.' })}
              </p>
              
              <div className="border border-white rounded-lg p-4">
                <h3 className="font-medium text-white mb-2">{t('pages.privacy.dataStaysLocal.aiModelsTitle', { defaultValue: 'DataKit AI Models - Column Schema Only' })}</h3>
                <p className="text-sm text-white">
                  <strong>{t('pages.privacy.dataStaysLocal.importantException', { defaultValue: 'Important exception:' })}</strong> {t('pages.privacy.dataStaysLocal.aiModelsDescription', { defaultValue: 'When you use DataKit\'s built-in AI models (powered by Anthropic\'s Claude), only your column names and data types are shared with our AI service to generate accurate SQL queries. Your actual data rows remain completely private and local to your browser.' })}
                </p>
                <p className="text-sm text-white mt-2">
                  {t('pages.privacy.dataStaysLocal.aiModelsExample', { defaultValue: 'For example, if you have a CSV with columns like "customer_name", "order_date", "amount" - only these column names and their types (text, date, number) are sent to help the AI understand your data structure. The actual customer names, dates, and amounts stay in your browser.' })}
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('pages.privacy.analytics.title', { defaultValue: 'Our Two-Tiered Analytics System' })}</h2>
              <p className="mb-3">{t('pages.privacy.analytics.description', { defaultValue: 'We use a privacy-first approach with two levels of analytics:' })}</p>
              
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-white mb-2">{t('pages.privacy.analytics.basic.title', { defaultValue: 'Basic Analytics (Always Active, No Consent Required):' })}</h3>
                <ul className="space-y-1 text-sm">
                  <li>• {t('pages.privacy.analytics.basic.pageViews', { defaultValue: 'Page views and basic navigation' })}</li>
                  <li>• {t('pages.privacy.analytics.basic.performance', { defaultValue: 'Performance metrics (query execution times, file load speeds)' })}</li>
                  <li>• {t('pages.privacy.analytics.basic.errorReports', { defaultValue: 'Error reports (JavaScript errors to help us fix bugs)' })}</li>
                  <li>• {t('pages.privacy.analytics.basic.featureAccess', { defaultValue: 'Feature access patterns (anonymous)' })}</li>
                </ul>
                <p className="text-xs text-white/60 mt-2">
                  {t('pages.privacy.analytics.basic.note', { defaultValue: 'These metrics help us understand app stability and performance without any personal data.' })}
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-white mb-2">{t('pages.privacy.analytics.advanced.title', { defaultValue: 'Advanced Analytics (With Your Consent):' })}</h3>
                <ul className="space-y-1 text-sm">
                  <li>• {t('pages.privacy.analytics.advanced.detailedUsage', { defaultValue: 'Detailed feature usage (which tabs you visit, chart types you create)' })}</li>
                  <li>• {t('pages.privacy.analytics.advanced.sessionRecordings', { defaultValue: 'Session recordings (with sensitive data masked)' })}</li>
                  <li>• {t('pages.privacy.analytics.advanced.userJourney', { defaultValue: 'User journey tracking' })}</li>
                  <li>• {t('pages.privacy.analytics.advanced.fileMetadata', { defaultValue: 'File metadata (file types and sizes, not content)' })}</li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-medium text-white mb-2">{t('pages.privacy.analytics.neverCollect.title', { defaultValue: 'What We Never Collect:' })}</h3>
                <ul className="space-y-1 text-sm">
                  <li>• {t('pages.privacy.analytics.neverCollect.files', { defaultValue: 'Your uploaded files or their content (actual data rows)' })}</li>
                  <li>• {t('pages.privacy.analytics.neverCollect.queries', { defaultValue: 'SQL queries or code you write' })}</li>
                  <li>• {t('pages.privacy.analytics.neverCollect.personalInfo', { defaultValue: 'Personal information or identifying data' })}</li>
                  <li>• {t('pages.privacy.analytics.neverCollect.sensitiveInputs', { defaultValue: 'Unmasked sensitive form inputs' })}</li>
                </ul>
                <p className="text-xs text-white/60 mt-3">
                  <em>{t('pages.privacy.analytics.neverCollect.note', { defaultValue: 'Note: When using DataKit AI models, only column schemas (names and types) are processed by our AI service - never your actual data.' })}</em>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('pages.privacy.thirdParty.title', { defaultValue: 'Third-Party Services' })}</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-white mb-2">{t('pages.privacy.thirdParty.analytics.title', { defaultValue: 'Analytics Provider' })}</h3>
                  <p className="text-sm">
                    {t('pages.privacy.thirdParty.analytics.description', { defaultValue: 'We use PostHog for analytics, a product analytics platform. PostHog helps us understand how you use DataKit while respecting your privacy through our two-tiered consent system. Basic anonymous metrics are collected to improve app stability, while advanced tracking requires your explicit consent.' })}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium text-white mb-2">{t('pages.privacy.thirdParty.ai.title', { defaultValue: 'AI Service Provider' })}</h3>
                  <p className="text-sm mb-2">
                    {t('pages.privacy.thirdParty.ai.description', { defaultValue: 'DataKit\'s built-in AI models are powered by Anthropic\'s Claude API. When you use these models:' })}
                  </p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• {t('pages.privacy.thirdParty.ai.columnNames', { defaultValue: 'Only your table column names and data types are sent to Anthropic' })}</li>
                    <li>• {t('pages.privacy.thirdParty.ai.prompts', { defaultValue: 'Your prompts and questions are processed to generate SQL queries' })}</li>
                    <li>• {t('pages.privacy.thirdParty.ai.noData', { defaultValue: 'No actual data content is ever transmitted' })}</li>
                    <li>• {t('pages.privacy.thirdParty.ai.privacyPolicy', { defaultValue: 'Anthropic processes this information according to their privacy policy' })}</li>
                    <li>• {t('pages.privacy.thirdParty.ai.ownKeys', { defaultValue: 'You can always use your own API keys (OpenAI, Anthropic, etc.) for full control' })}</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">{t('pages.privacy.choices.title', { defaultValue: 'Your Choices' })}</h2>
              <p className="mb-2">
                {t('pages.privacy.choices.analytics', { defaultValue: 'You can accept or decline analytics at any time. DataKit works fully without analytics enabled.' })}
              </p>
              <p>
                {t('pages.privacy.choices.preferences', { defaultValue: 'To change your preferences, click the privacy icon in the app or clear your browser data.' })}
              </p>
            </section>


            <div className="text-sm text-white/50 mt-12 pt-8 border-t border-white/10">
              {t('pages.privacy.lastUpdated', { defaultValue: 'Last updated' })}: {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Privacy;