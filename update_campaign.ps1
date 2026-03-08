$filePath = "C:\Users\Personal\TFMD-GSD\screens\MarketingApp.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# 1. Update the MarketingCampaign interface
$oldInterface = @'
export interface MarketingCampaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'paused';
  scheduledAt?: string;
'@

$newInterface = @'
export interface MarketingCampaign {
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
'@

$content = $content -replace [regex]::Escape($oldInterface), $newInterface

# 2. Replace the CampaignModal component - using a simpler pattern approach
$pattern = 'const CampaignModal: React.FC<CampaignModalProps> = \(.*?\n\}\;\n\nexport default MarketingApp;'
$newComponent = @'
const CampaignModal: React.FC<CampaignModalProps> = ({ campaign, subscriberCount, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: campaign?.name || '',
    subject: campaign?.subject || '',
    channel: campaign?.channel || 'email' as MarketingCampaign['channel'],
    recipientType: campaign?.recipientType || 'all' as MarketingCampaign['recipientType'],
    manualRecipients: campaign?.manualRecipients || '',
    content: campaign?.content || '',
    priority: campaign?.priority || 'normal' as MarketingCampaign['priority'],
    sendNow: campaign?.sendNow ?? true,
    status: campaign?.status || 'draft' as MarketingCampaign['status'],
    scheduledAt: campaign?.scheduledAt?.split('T')[0] || '',
    scheduledTime: campaign?.scheduledAt?.split('T')[1]?.substring(0, 5) || '09:00'
  });
  
  const handleSubmit = () => {
    if (!formData.name || !formData.subject) return;
    
    const scheduledAt = !formData.sendNow && formData.scheduledAt 
      ? `${formData.scheduledAt}T${formData.scheduledTime || '09:00'}:00`
      : undefined;
    
    const newCampaign: MarketingCampaign = {
      id: campaign?.id || `campaign-${Date.now()}`,
      name: formData.name,
      subject: formData.subject,
      channel: formData.channel,
      recipientType: formData.recipientType,
      manualRecipients: formData.recipientType === 'manual' ? formData.manualRecipients : undefined,
      content: formData.content || undefined,
      priority: formData.priority,
      sendNow: formData.sendNow,
      status: formData.sendNow ? 'active' : (formData.status === 'draft' ? 'draft' : formData.status),
      scheduledAt,
      recipients: campaign?.recipients || 0,
      sent: campaign?.sent || 0,
      delivered: campaign?.delivered || 0,
      opened: campaign?.opened || 0,
      clicked: campaign?.clicked || 0,
      converted: campaign?.converted || 0,
      createdAt: campaign?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    onSave(newCampaign);
  };
  
  return (
    <div className="fixed inset-0 bg-[#26150B]/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FBF7EF] rounded-[2rem] p-8 w-full max-w-lg shadow-2xl my-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-extrabold text-[#26150B] tracking-tight">
            {campaign ? 'Edit Campaign' : 'Create Campaign'}
          </h2>
          <button onClick={onClose} className="text-[#26150B]/40 hover:text-[#26150B] hover:bg-[#26150B]/5 rounded-full p-2 transition-all">
            <Icons.XIcon />
          </button>
        </div>
        
        <div className="space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          <div>
            <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider mb-2 block">Campaign Name *</label>
            <input 
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm"
              placeholder="e.g. Summer Promotion"
            />
          </div>
          
          <div>
            <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider mb-2 block">Channel *</label>
            <div className="flex gap-3">
              {(['email', 'sms', 'push'] as const).map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => setFormData({ ...formData, channel })}
                  className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all ${
                    formData.channel === channel
                      ? 'bg-[#6E7568] text-[#FBF7EF] shadow-lg'
                      : 'bg-white text-[#6E7568] border border-[#6E7568]/10 hover:bg-[#6E7568]/5'
                  }`}
                >
                  {channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'Push'}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider mb-2 block">Subject Line *</label>
            <input 
              type="text"
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm"
              placeholder="e.g. Get 20% Off This Summer!"
            />
          </div>
          
          <div>
            <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider mb-2 block">Recipient Type</label>
            <select 
              value={formData.recipientType}
              onChange={e => setFormData({ ...formData, recipientType: e.target.value as MarketingCampaign['recipientType'], manualRecipients: '' })}
              className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 outline-none shadow-sm"
            >
              <option value="all">All Subscribers</option>
              <option value="manual">Manual Selection</option>
              <option value="segment">Segment</option>
            </select>
          </div>
          
          {formData.recipientType === 'manual' && (
            <div>
              <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider mb-2 block">Recipients (comma-separated emails)</label>
              <textarea 
                value={formData.manualRecipients}
                onChange={e => setFormData({ ...formData, manualRecipients: e.target.value })}
                className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm resize-none"
                rows={3}
                placeholder="e.g. john@example.com, jane@example.com"
              />
            </div>
          )}
          
          {formData.channel === 'email' && (
            <div>
              <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider mb-2 block">Content Body</label>
              <textarea 
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                className="w-full p-4 rounded-2xl bg-white text-[#26150B] border border-[#6E7568]/10 focus:border-[#6E7568]/50 outline-none transition-all shadow-sm resize-none"
                rows={5}
                placeholder="Enter your email content here..."
              />
            </div>
          )}
          
          <div>
            <label className="text-xs font-bold text-[#6E7568] uppercase tracking-wider
