const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

async function optimizeImages() {
  console.log('🔄 Optimizing images...\n');
  
  // Read the original logo
  const logoPath = path.join(publicDir, 'logo.png');
  if (!fs.existsSync(logoPath)) {
    console.error('❌ logo.png not found in public directory');
    return;
  }
  
  const logoBuffer = fs.readFileSync(logoPath);
  
  // Get original dimensions
  const metadata = await sharp(logoBuffer).metadata();
  console.log(`Original logo: ${metadata.width}x${metadata.height}, ${(logoBuffer.length / 1024).toFixed(0)}KB`);
  
  // Convert to WebP with optimization
  const webpBuffer = await sharp(logoBuffer)
    .webp({ quality: 80 })
    .toBuffer();
  
  const webpPath = path.join(publicDir, 'logo.webp');
  fs.writeFileSync(webpPath, webpBuffer);
  console.log(`✅ Created logo.webp: ${(webpBuffer.length / 1024).toFixed(0)}KB (${Math.round((webpBuffer.length / logoBuffer.length) * 100)}% of original)`);
  
  // Create optimized PNG (smaller size)
  const optimizedPngBuffer = await sharp(logoBuffer)
    .png({ quality: 80, compressionLevel: 9 })
    .toBuffer();
  
  const optimizedPngPath = path.join(publicDir, 'logo-optimized.png');
  fs.writeFileSync(optimizedPngPath, optimizedPngBuffer);
  console.log(`✅ Created logo-optimized.png: ${(optimizedPngBuffer.length / 1024).toFixed(0)}KB (${Math.round((optimizedPngBuffer.length / logoBuffer.length) * 100)}% of original)`);
  
  // Create favicon.ico using sharp (supports ICO format directly)
  try {
    const icoPath = path.join(publicDir, 'favicon.ico');
    // Create a 32x32 ICO file (most compatible size)
    await sharp(logoBuffer)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFormat('png')
      .toFile(icoPath);
    
    const icoStats = fs.statSync(icoPath);
    console.log(`✅ Created favicon.ico: ${(icoStats.size / 1024).toFixed(0)}KB`);
  } catch (err) {
    console.error('❌ Failed to create favicon.ico:', err.message);
  }
  
  // Create various icon sizes for PWA
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  
  for (const size of sizes) {
    const resizedBuffer = await sharp(logoBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    const iconPath = path.join(publicDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(iconPath, resizedBuffer);
    console.log(`✅ Created icon-${size}x${size}.png: ${(resizedBuffer.length / 1024).toFixed(0)}KB`);
  }
  
  // Create apple-touch-icon
  const appleIconBuffer = await sharp(logoBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  const appleIconPath = path.join(publicDir, 'apple-touch-icon.png');
  fs.writeFileSync(appleIconPath, appleIconBuffer);
  console.log(`✅ Created apple-touch-icon.png: ${(appleIconBuffer.length / 1024).toFixed(0)}KB`);
  
  console.log('\n✨ Image optimization complete!');
}

optimizeImages().catch(console.error);
