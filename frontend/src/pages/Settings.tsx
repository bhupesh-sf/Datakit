import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Lock,
  Bell,
  Palette,
  Database,
  CreditCard,
  Shield,
  Crown,
  Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthStore } from "@/store/authStore";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SettingsSidebar from "@/components/layout/SettingsSidebar";
import WorkspaceSettings from "@/components/settings/WorkspaceSettings";
import AISettings from "@/components/settings/AISettings";
import AppearanceSettings from "@/components/settings/AppearanceSettings";
import { SEO } from "@/components/common/SEO";

const Settings: React.FC = () => {
  const { user, updateProfile, updateSettings, settings, isLoading } =
    useAuth();
  const { currentWorkspace } = useAuthStore();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  const [preferencesData, setPreferencesData] = useState({
    defaultAIProvider: settings?.defaultAIProvider || "openai",
    defaultModel: settings?.defaultModel || "gpt-4",
    theme: settings?.theme || "dark",
    emailNotifications: settings?.emailNotifications ?? true,
    usageAlerts: settings?.usageAlerts ?? true,
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        name: profileData.name,
      });
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const handlePreferencesUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings(preferencesData);
    } catch (error) {
      console.error("Failed to update preferences:", error);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-4">
                Profile Information
              </h3>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-background/20 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-3 py-2 bg-background/10 border border-white/10 rounded-md text-white/60 cursor-not-allowed"
                  />
                  <p className="text-xs text-white/50 mt-1">
                    Email cannot be changed. Contact support if needed.
                  </p>
                </div>

                <Button variant="outline" type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </div>
          </div>
        );

      case "workspace":
        return <WorkspaceSettings />;

      case "ai":
        return <AISettings />;

      case "appearance":
        return <AppearanceSettings />;

      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-4">
                Notification Preferences
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Email Notifications
                    </div>
                    <div className="text-xs text-white/60">
                      Receive updates about new features and announcements
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferencesData.emailNotifications}
                      onChange={(e) =>
                        setPreferencesData((prev) => ({
                          ...prev,
                          emailNotifications: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Usage Alerts
                    </div>
                    <div className="text-xs text-white/60">
                      Get notified when you're close to your credit limit
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferencesData.usageAlerts}
                      onChange={(e) =>
                        setPreferencesData((prev) => ({
                          ...prev,
                          usageAlerts: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <Button
                  variant="outline"
                  onClick={handlePreferencesUpdate}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Notification Settings"}
                </Button>
              </div>
            </div>
          </div>
        );

      case "subscription":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-4">
                Subscription & Usage
              </h3>

              {/* Current Plan Overview */}
              <div className="bg-background/10 border border-white/10 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Current Plan
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {user?.subscription?.tier ||
                        user?.subscription?.planType?.toUpperCase() ||
                        "FREE"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">
                      Credits Remaining
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {user?.subscription?.creditsRemaining === -1
                        ? "Unlimited"
                        : user?.subscription?.creditsRemaining ||
                          user?.credits?.remaining ||
                          0}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-white/60 mb-4">
                  {user?.subscription?.creditsResetAt &&
                    `Credits reset on ${new Date(
                      user.subscription.creditsResetAt
                    ).toLocaleDateString()}`}
                </div>

                <div className="space-y-2">
                  <Button variant="primary" className="w-full">
                    {user?.subscription?.planType === "free" ||
                    !user?.subscription?.planType
                      ? "Upgrade to Pro or Team"
                      : "Manage Subscription"}
                  </Button>
                  <Button variant="outline" className="w-full">
                    View Usage History
                  </Button>
                </div>
              </div>

              {/* Plan Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Free Plan */}
                <div
                  className={`bg-white/5 border rounded-lg p-4 ${
                    user?.subscription?.planType === "free" ||
                    !user?.subscription?.planType
                      ? "border-primary ring-1 ring-primary"
                      : "border-white/10"
                  }`}
                >
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-semibold text-white">Free</h4>
                    <p className="text-2xl font-bold text-primary">$0</p>
                    <p className="text-xs text-white/60">Personal use</p>
                  </div>
                  <ul className="space-y-2 text-sm text-white/80">
                    <li>• 100 credits/month</li>
                    <li>• Personal workspace</li>
                    <li>• Basic data analysis</li>
                    <li>• Community support</li>
                  </ul>
                </div>

                {/* Pro Plan */}
                <div
                  className={`bg-white/5 border rounded-lg p-4 ${
                    user?.subscription?.planType === "pro"
                      ? "border-primary ring-1 ring-primary"
                      : "border-white/10"
                  }`}
                >
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-semibold text-white">Pro</h4>
                    <p className="text-2xl font-bold text-primary">$19</p>
                    <p className="text-xs text-white/60">per month</p>
                  </div>
                  <ul className="space-y-2 text-sm text-white/80">
                    <li>• 10,000 credits/month</li>
                    <li>• DataKit AI access</li>
                    <li>• Advanced analytics</li>
                    <li>• Priority support</li>
                  </ul>
                </div>

                {/* Team Plan */}
                <div
                  className={`bg-white/5 border rounded-lg p-4 relative opacity-60 ${
                    user?.subscription?.planType === "team"
                      ? "border-primary ring-1 ring-primary"
                      : "border-white/10"
                  }`}
                >
                  {/* Coming Soon Badge */}
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-sky-800 to-green-800 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Coming Soon
                  </div>
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-semibold text-white/70">Team</h4>
                    <p className="text-2xl font-bold text-white/50">$-</p>
                    <p className="text-xs text-white/40">per month</p>
                  </div>
                  <ul className="space-y-2 text-sm text-white/50">
                    <li>• Unlimited credits</li>
                    <li>• Team collaboration</li>
                    <li>• Member management</li>
                    <li>• Premium support</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ProtectedRoute>
      <>
        <SEO
          title="Settings - DataKit"
          description="Manage your DataKit account settings, AI preferences, notifications, and subscription"
          keywords="settings, profile, ai settings, notifications, subscription, datakit"
        />

        <div className="flex h-screen bg-background overflow-hidden">
          {/* Settings Sidebar */}
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Main Content Area */}
          <div className="flex-1 h-full overflow-hidden flex items-center justify-center">
            <div className="w-full max-w-4xl p-8">
              <div className="bg-darkNav rounded-lg p-8">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </>
    </ProtectedRoute>
  );
};

export default Settings;
