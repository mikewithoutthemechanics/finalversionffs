import re

file_path = "screens/MarketingApp.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_interface = """export interface MarketingCampaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'paused';
  scheduledAt?: string;
}"""

new_interface = """export interface MarketingCampaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'paused';
  channel: 'email' | 'sms' | 'push';
  recipientType: 'all' | 'manual' | 'segment';
  manualRecipients?: string;
  content?: string;
  priority: 'normal' | 'high';
  sendNow: boolean;
  scheduledAt?: string;
}"""

content = content.replace(old_interface, new_interface)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Interface updated")
