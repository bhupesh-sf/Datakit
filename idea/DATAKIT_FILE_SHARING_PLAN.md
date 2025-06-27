# DataKit File Sharing Implementation Plan

## Problem Statement

DataKit is a powerful browser-based data analysis tool that processes CSV, XLSX, and other data files locally using DuckDB-wasm. Currently, users can only analyze files individually without the ability to share datasets with colleagues or collaborators. This limitation prevents DataKit from being used in team environments and collaborative data analysis workflows.

**Key Requirements:**
- Enable secure file sharing between DataKit users
- Maintain privacy and security for sensitive business data
- Leverage existing remote import infrastructure
- No complex server infrastructure (serverless-first approach)
- Monetizable feature for Pro/Enterprise tiers

## Solution Overview

We propose implementing a secure file sharing system that allows users to:
1. **Upload & Share**: Take any file loaded in DataKit → click share → get a secure link
2. **Access & Import**: Recipient visits link → enters password (optional) → file imports into their DataKit instance
3. **Maintain Privacy**: Files are encrypted before upload, with secure credential management

### Core Architecture

```
User A (Sharer)           DataKit Backend           File Storage           User B (Recipient)
      │                        │                        │                        │
   1. Share File ──────────────→ Generate Upload URL                            │
      │                        │                        │                        │
   2. Encrypt & Upload ─────────┼────────────────────────→ Store Encrypted File  │
      │                        │                        │                        │
   3. Create Share Link ←───────┤                        │                        │
      │                        │                        │                        │
      │                     4. Share Link ──────────────────────────────────────→│
      │                        │                        │                        │
      │                     5. Validate Access ←────────┼────────────────────────┤
      │                        │                        │                        │
      │                     6. Get Download URL ←───────┼────────────────────────┤
      │                        │                        │                        │
      │                        │          7. Download & Decrypt ←───────────────┤
```

## Security Analysis: Why Not IPFS for Sensitive Files

### IPFS Security Concerns

**❌ Public by Default**
- All content on IPFS is publicly accessible by anyone with the Content ID (CID)
- Metadata including node IDs and CIDs are visible in public DHT
- Even "private" data can be discovered through network analysis

**❌ No Built-in Encryption**
- IPFS only provides transport encryption, not content encryption
- Files are stored in plaintext unless manually encrypted beforehand
- Content addressing means identical files have identical, predictable CIDs

**❌ Persistent & Immutable**
- Once data is on IPFS, it's difficult to remove completely
- Future cryptographic breakthroughs could decrypt today's "secure" data
- No access control or permission management

**❌ Compliance Issues**
- GDPR "right to be forgotten" is nearly impossible to enforce
- No audit trails or access logging
- Difficult to meet enterprise security requirements

### Recommended Alternative: Encrypted Cloud Storage

For sensitive business data, we recommend using traditional cloud storage with client-side encryption:

**✅ Pinata (IPFS) with Client-Side Encryption**
- Encrypt files before uploading to Pinata
- Use AES-256-GCM with Web Crypto API
- Store encryption keys separately from file storage

**✅ Alternative: Traditional Cloud Storage**
- AWS S3 with client-side encryption
- Google Cloud Storage with customer-managed keys
- Azure Blob Storage with envelope encryption

## Technical Implementation

### Backend Architecture: NestJS + Supabase

**Why NestJS?**
- TypeScript-first with excellent developer experience
- Built-in authentication, validation, and security features
- Scalable architecture with dependency injection
- Easy integration with Supabase and cloud services

**Why Supabase?**
- Serverless PostgreSQL with built-in authentication
- Row Level Security (RLS) for fine-grained access control
- Real-time capabilities for future features
- JWT-based authentication integrates well with NestJS

### Database Schema

```sql
-- Supabase PostgreSQL Schema
CREATE TABLE file_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File metadata
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_hash VARCHAR(128) NOT NULL, -- SHA-256 hash for deduplication
  
  -- Storage information
  storage_provider VARCHAR(50) NOT NULL, -- 'pinata', 's3', 'gcs'
  storage_id VARCHAR(255) NOT NULL, -- Provider-specific file ID
  encryption_key_id UUID NOT NULL, -- Reference to encryption key (stored separately)
  
  -- Access control
  password_hash VARCHAR(255), -- bcrypt hash (optional)
  expires_at TIMESTAMP,
  max_downloads INTEGER DEFAULT NULL,
  download_count INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP,
  
  -- Privacy
  creator_ip INET,
  is_public BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE file_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own shares" ON file_shares
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can create shares" ON file_shares
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Encryption keys stored separately for security
CREATE TABLE encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash VARCHAR(128) NOT NULL, -- Hashed version for lookup
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Download tracking
CREATE TABLE share_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_id UUID REFERENCES file_shares(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP DEFAULT NOW(),
  downloader_ip INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE
);
```

### NestJS Backend Implementation

**Project Structure:**
```
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── supabase.guard.ts
├── files/
│   ├── files.module.ts
│   ├── files.controller.ts
│   ├── files.service.ts
│   └── dto/
│       ├── create-share.dto.ts
│       └── access-share.dto.ts
├── storage/
│   ├── storage.module.ts
│   ├── storage.service.ts
│   └── providers/
│       ├── pinata.provider.ts
│       └── s3.provider.ts
├── encryption/
│   ├── encryption.module.ts
│   └── encryption.service.ts
└── common/
    ├── guards/
    └── decorators/
```

**Key Services:**

```typescript
// files.service.ts
@Injectable()
export class FilesService {
  constructor(
    private supabase: SupabaseService,
    private storage: StorageService,
    private encryption: EncryptionService,
  ) {}

  async createShare(
    userId: string,
    file: Express.Multer.File,
    options: CreateShareDto,
  ): Promise<ShareResponse> {
    // 1. Generate encryption key
    const encryptionKey = await this.encryption.generateKey();
    
    // 2. Encrypt file
    const encryptedFile = await this.encryption.encrypt(file.buffer, encryptionKey);
    
    // 3. Upload to storage provider
    const storageResult = await this.storage.upload(encryptedFile);
    
    // 4. Create share record
    const share = await this.supabase
      .from('file_shares')
      .insert({
        creator_id: userId,
        file_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
        storage_provider: storageResult.provider,
        storage_id: storageResult.id,
        encryption_key_id: encryptionKey.id,
        password_hash: options.password ? await bcrypt.hash(options.password, 12) : null,
        expires_at: options.expiresAt,
        max_downloads: options.maxDownloads,
      })
      .single();
    
    return {
      shareUrl: `https://datakit.page/files/share?id=${share.id}`,
      expiresAt: share.expires_at,
    };
  }

  async accessShare(shareId: string, password?: string): Promise<FileAccessResponse> {
    // 1. Get share record
    const share = await this.supabase
      .from('file_shares')
      .select('*')
      .eq('id', shareId)
      .single();
    
    // 2. Validate access
    await this.validateAccess(share, password);
    
    // 3. Get encryption key
    const encryptionKey = await this.encryption.getKey(share.encryption_key_id);
    
    // 4. Generate signed download URL
    const downloadUrl = await this.storage.getSignedUrl(
      share.storage_provider,
      share.storage_id,
    );
    
    // 5. Track download
    await this.trackDownload(shareId);
    
    return {
      downloadUrl,
      encryptionKey: encryptionKey.key, // Only sent to authorized users
      fileName: share.file_name,
      fileSize: share.file_size,
    };
  }
}
```

### Frontend Integration

**Existing Components to Modify:**

1. **Add Share Button to Sidebar** (`src/components/Sidebar.tsx`)
```tsx
// Add share button next to file name
<Button
  variant="ghost"
  size="sm"
  onClick={() => setShowShareModal(true)}
>
  <Share2 className="w-4 h-4" />
</Button>
```

2. **Extend Remote Import Modal** (`src/components/common/RemoteDataImportPanel.tsx`)
```tsx
// Add DataKit share option to existing providers
const providers = [
  ...existingProviders,
  {
    id: 'datakit-share',
    name: 'DataKit Shared File',
    icon: DataKitIcon,
    urlPattern: /datakit\.page\/files\/share\?id=(.+)/,
    component: DataKitShareImport,
  }
];
```

3. **New Share Modal Component**
```tsx
// src/components/modals/FileShareModal.tsx
interface ShareOptions {
  password?: string;
  expiresIn?: string; // '7d', '30d', '90d', 'never'
  maxDownloads?: number;
}

export function FileShareModal({ file, onClose }: Props) {
  const [shareOptions, setShareOptions] = useState<ShareOptions>({});
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const response = await fetch('/api/files/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileData: await file.arrayBuffer(),
          ...shareOptions,
        }),
      });
      
      const result = await response.json();
      setShareUrl(result.shareUrl);
    } catch (error) {
      console.error('Failed to share file:', error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Share File</h2>
        
        {!shareUrl ? (
          <>
            {/* Share options form */}
            <div>
              <label>Password (optional)</label>
              <Input
                type="password"
                value={shareOptions.password || ''}
                onChange={(e) => setShareOptions(prev => ({
                  ...prev,
                  password: e.target.value
                }))}
              />
            </div>
            
            <div>
              <label>Expires</label>
              <Select
                value={shareOptions.expiresIn || '7d'}
                onChange={(value) => setShareOptions(prev => ({
                  ...prev,
                  expiresIn: value
                }))}
              >
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="never">Never</option>
              </Select>
            </div>
            
            <Button onClick={handleShare} disabled={isSharing}>
              {isSharing ? 'Creating share link...' : 'Create Share Link'}
            </Button>
          </>
        ) : (
          <>
            {/* Share URL display */}
            <div>
              <label>Share URL</label>
              <div className="flex items-center space-x-2">
                <Input value={shareUrl} readOnly />
                <Button onClick={() => navigator.clipboard.writeText(shareUrl)}>
                  Copy
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
```

### Security Measures

**Client-Side Encryption:**
```typescript
// src/lib/encryption.ts
export class FileEncryption {
  static async encrypt(file: ArrayBuffer): Promise<{
    encryptedData: ArrayBuffer;
    key: CryptoKey;
    iv: Uint8Array;
  }> {
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      file
    );
    
    return { encryptedData, key, iv };
  }
  
  static async decrypt(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    return await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
  }
}
```

## Monetization Strategy

### Tier Structure

**Free Tier (Community):**
- 7-day link expiration
- Password protection
- 100MB file size limit
- 10 downloads per link
- Basic file types (CSV, JSON, TXT)

**Pro Tier ($19/month):**
- Custom expiration (up to 1 year)
- 10GB file size limit
- 1000 downloads per link
- All file types (XLSX, Parquet, etc.)
- Download analytics
- Batch sharing

**Enterprise Tier ($99/month):**
- Permanent links
- Unlimited file size
- Unlimited downloads
- Team management
- Audit logs
- API access
- Custom domains
- SSO integration

### Revenue Projections

**Year 1 Targets:**
- 10,000 free users
- 500 Pro subscribers ($9,500/month)
- 50 Enterprise customers ($4,950/month)
- **Total: $14,450/month → $173,400/year**

**Operating Costs:**
- Backend hosting (NestJS): $50/month
- Supabase Pro: $25/month
- File storage (S3/Pinata): $200/month
- CDN & bandwidth: $100/month
- **Total: $375/month → $4,500/year**

**Net Profit Year 1: ~$168,900**

## Implementation Timeline

### Phase 1: Backend Foundation (Weeks 1-3)
- [ ] Set up NestJS project with Supabase integration
- [ ] Implement authentication and JWT strategy
- [ ] Create database schema and RLS policies
- [ ] Build file upload/download APIs
- [ ] Implement client-side encryption

### Phase 2: Frontend Integration (Weeks 4-5)
- [ ] Add share button to existing UI
- [ ] Create file share modal
- [ ] Extend remote import modal for shared files
- [ ] Implement password protection flow

### Phase 3: Security & Testing (Week 6)
- [ ] Security audit of encryption implementation
- [ ] End-to-end testing of share flow
- [ ] Performance testing with large files
- [ ] CORS and browser compatibility testing

### Phase 4: Monetization & Launch (Weeks 7-8)
- [ ] Implement tier restrictions
- [ ] Add billing integration (Stripe)
- [ ] Create usage analytics dashboard
- [ ] Launch beta with select users

### Phase 5: Scale & Optimize (Weeks 9-12)
- [ ] Monitor usage patterns and costs
- [ ] Optimize file storage and bandwidth
- [ ] Add advanced features (batch sharing, analytics)
- [ ] Enterprise features (SSO, audit logs)

## Success Metrics

**Technical Metrics:**
- File upload success rate > 99%
- Download success rate > 99%
- Average share creation time < 5 seconds
- Average file access time < 3 seconds

**Business Metrics:**
- Monthly share creation growth > 20%
- Free to Pro conversion rate > 5%
- Pro to Enterprise conversion rate > 10%
- Customer churn rate < 5%

**Security Metrics:**
- Zero data breaches
- Zero unauthorized file access
- 100% encryption coverage for sensitive files
- Full compliance with data protection regulations

## Risk Mitigation

**Technical Risks:**
- **Large file uploads**: Implement chunked uploads and progress tracking
- **Browser compatibility**: Thorough testing across browsers and devices
- **Encryption key management**: Use secure key derivation and storage

**Business Risks:**
- **Competitor response**: Focus on DataKit's unique browser-based advantage
- **Regulatory changes**: Stay updated on data protection laws
- **Scaling costs**: Monitor usage patterns and optimize storage costs

**Security Risks:**
- **Client-side encryption**: Regular security audits and penetration testing
- **Access control**: Implement robust authentication and authorization
- **Data retention**: Clear policies and automated cleanup processes

## Conclusion

This file sharing feature will transform DataKit from a single-user tool into a collaborative platform while maintaining its core strength of browser-based data analysis. By implementing strong security measures with client-side encryption and leveraging a modern tech stack (NestJS + Supabase), we can create a premium feature that generates significant revenue while serving users' collaboration needs.

The combination of DataKit's unique DuckDB-in-browser capability with secure file sharing creates a differentiated offering in the data analysis market, positioning us well against competitors like Hex, Deepnote, and Observable.