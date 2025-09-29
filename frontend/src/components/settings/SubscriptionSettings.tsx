import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Bell } from 'lucide-react';
import GlareHover from '@/components/ui/GlareHover';
import { useAuth } from '@/hooks/auth/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useNotifications } from '@/hooks/useNotifications';
import userService from '@/lib/api/userService';
import AnthropicLogo from '@/assets/anthropic.webp';

interface PricingCardProps {
  title: string;
  price: string | number;
  period?: string;
  description: string;
  features: string[];
  isCurrentPlan?: boolean;
  isPopular?: boolean;
  isComingSoon?: boolean;
  isEarlyAdopter?: boolean;
  icon?: React.ReactNode;
  onSelect?: () => void;
}

const PricingCard: React.FC<PricingCardProps> = ({
  title,
  price,
  period,
  description,
  features,
  isCurrentPlan = false,
  isComingSoon = false,
  isEarlyAdopter = false,
  icon,
  onSelect,
}) => {
  const cardContent = (
    <div className="h-full flex flex-col p-4 relative">
      {/* Compact Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center mb-2">
          {icon && <div className="mr-2 text-primary">{icon}</div>}
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <div className="mb-2">
          <span className="text-2xl font-bold text-white">
            {typeof price === 'string' ? price : `$${price}`}
          </span>
          {period && <span className="text-white/60 ml-1">/{period}</span>}
        </div>
        <p className="text-xs text-white/70">{description}</p>
      </div>

      {/* Compact Features */}
      <div className="flex-1">
        <ul className="space-y-2">
          {features.slice(0, 4).map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-3 w-3 text-primary mt-0.5 mr-2 flex-shrink-0" />
              <span className="text-xs text-white/80">{feature}</span>
            </li>
          ))}
          {features.length > 4 && (
            <li className="text-xs text-white/60 ml-5">
              {t('settings.subscription.moreFeatures', { defaultValue: '+{count} more features', count: features.length - 4 })}
            </li>
          )}
        </ul>

        {/* Free Plan Anthropic Message */}
        
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Floating badges - positioned outside the card */}
      {isEarlyAdopter && !isComingSoon && (
        <div className="absolute -top-4 -left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-medium px-3 py-1 rounded-full z-30 shadow-lg">
          {t('settings.subscription.badges.earlyAdopter', { defaultValue: 'Early Adopter: 20% OFF' })}
        </div>
      )}

      {isComingSoon && title !== 'Pro' && (
        <div className="absolute -top-4 -right-2 bg-gradient-to-r from-sky-800 to-green-800 text-white text-xs font-medium px-3 py-1 rounded-full z-30 shadow-lg">
          {t('settings.subscription.badges.comingSoon', { defaultValue: 'Coming Soon' })}
        </div>
      )}

      {/* Pro Plan Anthropic Badge */}
      {title === 'Pro' && isComingSoon && (
        <div className="absolute -top-4 -right-2 bg-gradient-to-r from-sky-600 via-sky-700 to-cyan-700 text-white text-xs font-medium px-3 py-1 rounded-full z-30 shadow-lg flex items-center gap-1">
          <img src={AnthropicLogo} className="h-3 w-3" alt="Anthropic" />
          <span>{t('settings.subscription.badges.moreCredits', { defaultValue: 'More credits soon!' })}</span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary to-primary/80 text-white text-xs font-medium px-4 py-1 rounded-full z-30 shadow-lg">
          {t('settings.subscription.badges.currentPlan', { defaultValue: 'Current Plan' })}
        </div>
      )}

      <GlareHover
        width="100%"
        height="100%"
        background="linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
        borderRadius="12px"
        borderColor={
          isCurrentPlan
            ? 'rgba(var(--primary), 0.5)'
            : isEarlyAdopter
            ? 'rgba(168, 85, 247, 0.5)'
            : 'rgba(255,255,255,0.1)'
        }
        glareColor="#ffffff"
        glareOpacity={0.15}
        glareAngle={-30}
        glareSize={300}
        transitionDuration={800}
        className={`
          transition-all duration-300 hover:scale-[1.02] hover:shadow-xl
          ${isCurrentPlan ? 'shadow-lg shadow-primary/20' : ''}
          ${isComingSoon ? 'opacity-75' : ''}
          ${isEarlyAdopter ? 'shadow-lg shadow-purple-500/20' : ''}
          h-full
        `}
        style={{
          borderWidth: '1px',
          borderStyle: 'solid',
        }}
      >
        {cardContent}
      </GlareHover>
    </div>
  );
};

const SubscriptionSettings: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { creditsRemaining } = useCredits();
  const { showSuccess } = useNotifications();
  const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);

  const currentPlan = user?.subscription?.planType || 'free';

  const plans = [
    {
      title: t('settings.subscription.plans.free.title', { defaultValue: 'Free' }),
      price: 0,
      period: t('settings.subscription.plans.period.month', { defaultValue: 'month' }),
      description: t('settings.subscription.plans.free.description', { defaultValue: 'Perfect for getting started' }),
      features: [
        t('settings.subscription.plans.free.features.credits', { defaultValue: '315 credits per month' }),
        t('settings.subscription.plans.free.features.anthropicModels', { defaultValue: 'Powered by Anthropic models' }),
        t('settings.subscription.plans.free.features.personalWorkspace', { defaultValue: 'Personal workspace' }),
        t('settings.subscription.plans.free.features.basicAnalysis', { defaultValue: 'Basic data analysis' }),
        t('settings.subscription.plans.free.features.communitySupport', { defaultValue: 'Community support' }),
      ],
      isCurrentPlan: currentPlan === 'free',
      icon: <></>,
    },
    {
      title: t('settings.subscription.plans.pro.title', { defaultValue: 'Pro' }),
      price: 19,
      period: t('settings.subscription.plans.period.month', { defaultValue: 'month' }),
      description: t('settings.subscription.plans.pro.description', { defaultValue: 'With more Anthropic credits' }),
      features: [
        t('settings.subscription.plans.pro.features.credits', { defaultValue: '1500 credits per month' }),
        t('settings.subscription.plans.pro.features.advancedAnalytics', { defaultValue: 'Advanced analytics' }),
        t('settings.subscription.plans.pro.features.prioritySupport', { defaultValue: 'Priority support' }),
        t('settings.subscription.plans.pro.features.exportCapabilities', { defaultValue: 'More export capabilities' }),
        t('settings.subscription.plans.pro.features.advancedIntegrations', { defaultValue: 'Advanced integrations' }),
      ],
      isCurrentPlan: currentPlan === 'pro',
      isPopular: true,
      isComingSoon: true,
      icon: <img src={AnthropicLogo} className="h-4 w-4" alt="Anthropic" />,
    },
    {
      title: t('settings.subscription.plans.team.title', { defaultValue: 'Team' }),
      price: t('settings.subscription.plans.team.price', { defaultValue: 'Custom' }),
      description: t('settings.subscription.plans.team.description', { defaultValue: 'For growing teams' }),
      features: [
        t('settings.subscription.plans.team.features.unlimitedCredits', { defaultValue: 'Unlimited credits' }),
        t('settings.subscription.plans.team.features.teamCollaboration', { defaultValue: 'Team collaboration' }),
        t('settings.subscription.plans.team.features.multipleWorkspaces', { defaultValue: 'Multiple Workspaces' }),
        t('settings.subscription.plans.team.features.memberManagement', { defaultValue: 'Member management' }),
        t('settings.subscription.plans.team.features.premiumSupport', { defaultValue: 'Premium support' }),
        t('settings.subscription.plans.team.features.customIntegrations', { defaultValue: 'Custom integrations' }),
        t('settings.subscription.plans.team.features.advancedSecurity', { defaultValue: 'Advanced security' }),
        t('settings.subscription.plans.team.features.accountManager', { defaultValue: 'Dedicated account manager' }),
      ],
      isCurrentPlan: currentPlan === 'team',
      isComingSoon: true,
      icon: <></>,
    },
  ];

  const handlePlanSelect = (planTitle: string) => {
    // Handle plan selection logic here
    console.log(`Selected plan: ${planTitle}`);
  };

  const handleWaitlistSignup = async (featureName: string) => {
    if (!user?.email && !waitlistEmail) {
      setShowEmailModal(true);
      return;
    }

    setIsWaitlistLoading(true);
    try {
      const email = user?.email || waitlistEmail;
      await userService.joinWaitlist(email, featureName);
      
      // Show success notification
      showSuccess(
        t('settings.subscription.waitlist.successTitle', { defaultValue: "You're on the waitlist!" }),
        t('settings.subscription.waitlist.successMessage', { defaultValue: `We'll let you know at ${email} when ${featureName} features roll out.` })
      );
      
      // Reset modal state
      setShowEmailModal(false);
      setWaitlistEmail('');
    } catch (error) {
      console.error('Waitlist signup failed:', error);
      alert(t('settings.subscription.waitlist.error', { defaultValue: 'Something went wrong. Please try again.' }));
    } finally {
      setIsWaitlistLoading(false);
    }
  };

  const handleEmailSubmit = () => {
    if (waitlistEmail) {
      handleWaitlistSignup('Pro');
    }
  };
console.log('creditsRemaining', creditsRemaining);
  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      {/* Compact Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">
          {t('settings.subscription.title', { defaultValue: 'Subscription Plans' })}
        </h2>
        <p className="text-sm text-white/70">
          {t('settings.subscription.description', { defaultValue: 'Choose the plan that fits your needs' })}
        </p>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        {/* Left Column - Current Usage (Compact) */}
        <div className="lg:col-span-1 lg:mr-4">
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-4 h-full">
            <h3 className="text-sm font-semibold text-white mb-4">
              {t('settings.subscription.currentUsage.title', { defaultValue: 'Current Usage' })}
            </h3>
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-primary">
                  {creditsRemaining === -1 ? '∞' : Number(creditsRemaining).toFixed(2) || 0}
                </div>
                <div className="text-xs text-white/60">{t('settings.subscription.currentUsage.creditsRemaining', { defaultValue: 'Credits Remaining' })}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-white">
                  {user?.subscription?.planType?.toUpperCase() || 'FREE'}
                </div>
                <div className="text-xs text-white/60">{t('settings.subscription.currentUsage.currentPlan', { defaultValue: 'Current Plan' })}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <div className="text-sm font-bold text-white">
                  {user?.subscription?.creditsResetAt
                    ? new Date(
                        user.subscription.creditsResetAt
                      ).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </div>
                <div className="text-xs text-white/60">{t('settings.subscription.currentUsage.nextReset', { defaultValue: 'Next Reset' })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Pricing Plans (Compact Grid) */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {plans.map((plan, index) => (
              <div key={index} className="flex flex-col">
                <PricingCard
                  title={plan.title}
                  price={plan.price}
                  period={plan.period}
                  description={plan.description}
                  features={plan.features}
                  isCurrentPlan={plan.isCurrentPlan}
                  isPopular={plan.isPopular}
                  isComingSoon={plan.isComingSoon}
                  isEarlyAdopter={plan.isEarlyAdopter}
                  icon={plan.icon}
                  onSelect={() => handlePlanSelect(plan.title)}
                />
                
                {/* Waitlist Button */}
                <div className="flex justify-center mt-4 pb-1">
                  {plan.isComingSoon ? (
                    <button
                      onClick={() => handleWaitlistSignup(plan.title)}
                      disabled={isWaitlistLoading}
                      className="group flex items-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 text-primary font-medium text-sm px-4 py-2 rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50 shadow-sm hover:shadow-md"
                    >
                      <Bell className="h-4 w-4 group-hover:animate-pulse" />
                      {isWaitlistLoading ? t('settings.subscription.waitlist.joining', { defaultValue: 'Joining...' }) : t('settings.subscription.waitlist.getNotified', { defaultValue: 'Get notified' })}
                    </button>
                  ) : (
                    <div className="h-10"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Email Modal for Anonymous Users */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">{t('settings.subscription.waitlist.modalTitle', { defaultValue: 'Join Waitlist' })}</h3>
            <p className="text-white/70 text-sm mb-4">
              {t('settings.subscription.waitlist.modalDescription', { defaultValue: 'Enter your email to get notified when Pro features are released.' })}
            </p>
            <input
              type="email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder={t('settings.subscription.waitlist.emailPlaceholder', { defaultValue: 'your.email@example.com' })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-primary"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 bg-white/5 border border-white/10 text-white text-sm py-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {t('settings.subscription.waitlist.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                onClick={handleEmailSubmit}
                disabled={!waitlistEmail || isWaitlistLoading}
                className="flex-1 bg-primary text-white text-sm py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isWaitlistLoading ? t('settings.subscription.waitlist.joining', { defaultValue: 'Joining...' }) : t('settings.subscription.waitlist.joinWaitlist', { defaultValue: 'Join Waitlist' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionSettings;
