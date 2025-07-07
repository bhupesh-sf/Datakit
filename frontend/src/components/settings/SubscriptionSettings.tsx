import React from "react";
import { Check } from "lucide-react";
import GlareHover from "@/components/ui/GlareHover";
import { useAuth } from "@/hooks/auth/useAuth";
import { useCredits } from "@/hooks/useCredits";

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
  onSelect
}) => {
  const cardContent = (
    <div className="h-full flex flex-col p-6 relative pt-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-3">
          {icon && <div className="mr-2 text-primary">{icon}</div>}
          <h3 className="text-xl font-bold text-white">
            {title}
          </h3>
        </div>
        <div className="mb-2">
          <span className="text-4xl font-bold text-white">
            {typeof price === 'string' ? price : `$${price}`}
          </span>
          {period && <span className="text-white/60 ml-1">/{period}</span>}
        </div>
        <p className="text-sm text-white/70">{description}</p>
      </div>

      {/* Features */}
      <div className="flex-1 mb-6">
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-4 w-4 text-primary mt-0.5 mr-3 flex-shrink-0" />
              <span className="text-sm text-white/80">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Floating badges - positioned outside the card */}
      {isEarlyAdopter && (
        <div className="absolute -top-4 -left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-medium px-3 py-1 rounded-full z-30 shadow-lg">
          Early Adopter: 20% OFF
        </div>
      )}
      
      
      {isComingSoon && (
        <div className="absolute -top-4 -right-2 bg-gradient-to-r from-sky-800 to-green-800 text-white text-xs font-medium px-3 py-1 rounded-full z-30 shadow-lg">
          Coming Soon
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary to-primary/80 text-white text-xs font-medium px-4 py-1 rounded-full z-30 shadow-lg">
          Current Plan
        </div>
      )}

      <GlareHover
        width="100%"
        height="100%"
        background="linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
        borderRadius="12px"
        borderColor={isCurrentPlan ? "rgba(var(--primary), 0.5)" : isEarlyAdopter ? "rgba(168, 85, 247, 0.5)" : "rgba(255,255,255,0.1)"}
        glareColor="#ffffff"
        glareOpacity={0.15}
        glareAngle={-30}
        glareSize={300}
        transitionDuration={800}
        className={`
          transition-all duration-300 hover:scale-105 hover:shadow-2xl
          ${isCurrentPlan ? 'shadow-lg shadow-primary/20' : ''}
          ${isComingSoon ? 'opacity-60' : ''}
          ${isEarlyAdopter ? 'shadow-lg shadow-purple-500/20' : ''}
          min-h-[400px]
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
  const { user } = useAuth();
  const { creditsRemaining } = useCredits();

  const currentPlan = user?.subscription?.planType || 'free';

  const plans = [
    {
      title: "Free",
      price: 0,
      period: "month", 
      description: "Perfect for getting started",
      features: [
        "315 credits per month",
        "Personal workspace",
        "Basic data analysis",
        "Community support",
        "Standard AI models"
      ],
      isCurrentPlan: currentPlan === 'free',
      icon: <></>
    },
    {
      title: "Pro",
      price: 19,
      period: "month",
      description: "Best for professionals", 
      features: [
        "10,000 credits per month",
        "DataKit AI access",
        "Advanced analytics",
        "Priority support",
        "Premium AI models",
        "Export capabilities",
        "Advanced integrations"
      ],
      isCurrentPlan: currentPlan === 'pro',
      isPopular: true,
      isEarlyAdopter: true,
      icon: <></>
    },
    {
      title: "Team",
      price: "Custom",
      description: "For growing teams",
      features: [
        "Unlimited credits",
        "Team collaboration",
        "Member management",
        "Premium support",
        "Custom integrations",
        "Advanced security",
        "Dedicated account manager"
      ],
      isCurrentPlan: currentPlan === 'team',
      isComingSoon: true,
      icon: <></>
    }
  ];

  const handlePlanSelect = (planTitle: string) => {
    // Handle plan selection logic here
    console.log(`Selected plan: ${planTitle}`);
  };


  return (
    <div className="space-y-8">
      {/* Current Usage Overview */}
      <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Current Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {creditsRemaining === -1
                ? "∞"
                : creditsRemaining ||  0}
            </div>
            <div className="text-sm text-white/60">Credits Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {user?.subscription?.planType?.toUpperCase() || "FREE"}
            </div>
            <div className="text-sm text-white/60">Current Plan</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {user?.subscription?.creditsResetAt 
                ? new Date(user.subscription.creditsResetAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })
                : "N/A"
              }
            </div>
            <div className="text-sm text-white/60">Next Reset</div>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Choose Your Plan</h2>
          <p className="text-white/70">Upgrade to unlock more features and higher limits</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <PricingCard
              key={index}
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSettings;