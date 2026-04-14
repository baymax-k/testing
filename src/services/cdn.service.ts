import ImageKit from '@imagekit/nodejs';

interface CDNUploadResult {
  success: boolean;
  url?: string;
  fileId?: string;
  error?: string;
}

class CDNService {
  private imagekit: ImageKit | null = null;

  constructor() {
    try {
      // Initialize ImageKit only if credentials are provided
      if (process.env.IMAGEKIT_PUBLIC_KEY_ID && 
          process.env.IMAGEKIT_PRIVATE_KEY && 
          process.env.IMAGEKIT_URL_ENDPOINT) {
        
        this.imagekit = new ImageKit({
          publicKeyId: process.env.IMAGEKIT_PUBLIC_KEY_ID!,
          privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
          urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!
        } as any);
        
        console.log('✅ CDN Service (ImageKit) initialized');
      } else {
        console.warn('⚠️ ImageKit credentials not found - HEX files will be stored in database');
      }
    } catch (error) {
      console.error('❌ Failed to initialize ImageKit:', error);
    }
  }

  /**
   * Upload HEX file to CDN
   */
  async uploadHexFile(
    hexContent: string, 
    submissionId: string, 
    problemId: string
  ): Promise<CDNUploadResult> {
    
    // If ImageKit not configured, return error to fall back to database storage
    if (!this.imagekit) {
      return {
        success: false,
        error: 'CDN service not configured - falling back to database storage'
      };
    }

    try {
      const fileName = `hex-files/${problemId}/${submissionId}.hex`;
      
      // Convert HEX content to buffer
      const fileBuffer = Buffer.from(hexContent, 'utf8');
      
      const uploadResult = await (this.imagekit as any).upload({
        file: fileBuffer,
        fileName: fileName,
        folder: 'arduino-hex-files',
        useUniqueFileName: false, // We're already using submissionId for uniqueness
        tags: ['arduino', 'hex', 'compilation'],
        customMetadata: {
          submissionId,
          problemId,
          uploadedAt: new Date().toISOString()
        }
      });

      console.log(`✅ HEX file uploaded to CDN: ${uploadResult.url}`);
      
      return {
        success: true,
        url: uploadResult.url,
        fileId: uploadResult.fileId
      };
      
    } catch (error: any) {
      console.error('❌ CDN upload failed:', error.message);
      return {
        success: false,
        error: error.message || 'CDN upload failed'
      };
    }
  }

  /**
   * Delete HEX file from CDN
   */
  async deleteHexFile(fileId: string): Promise<boolean> {
    if (!this.imagekit) {
      return false;
    }

    try {
      await (this.imagekit as any).deleteFile(fileId);
      console.log(`✅ HEX file deleted from CDN: ${fileId}`);
      return true;
    } catch (error: any) {
      console.error('❌ CDN delete failed:', error.message);
      return false;
    }
  }

  /**
   * Check if CDN is available
   */
  isAvailable(): boolean {
    return this.imagekit !== null;
  }
}

export const cdnService = new CDNService();